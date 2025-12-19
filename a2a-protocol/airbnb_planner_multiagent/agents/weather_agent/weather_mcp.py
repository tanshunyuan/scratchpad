import json
from typing import Any

import httpx
from geopy.exc import GeocoderServiceError, GeocoderTimedOut
from geopy.geocoders import Nominatim
from loguru import logger
from mcp.server.fastmcp import FastMCP

# Initialize FastMCP server
mcp = FastMCP("weather")

# --- Configuration & Constants ---
BASE_URL = "https://api.weather.gov"
USER_AGENT = "weather-agent"
REQUEST_TIMEOUT = 20.0
GEOCODE_TIMEOUT = 10.0  # Timeout for geocoding requests

# --- Shared HTTP Client ---
http_client = httpx.AsyncClient(
    base_url=BASE_URL,
    headers={"User-Agent": USER_AGENT, "Accept": "application/geo+json"},
    timeout=REQUEST_TIMEOUT,
    follow_redirects=True,
)

# --- Geocoding Setup ---
# Initialize the geocoder (Nominatim requires a unique user_agent)
geolocator = Nominatim(user_agent=USER_AGENT)


async def get_weather_response(endpoint: str) -> dict[str, Any] | None:
    """
    Make a request to the NWS API using the shared client with error handling.

    Args:
        endpoint: The endpoint to request.

    Returns:
        The response from the NWS API, or None if an error occurs
    """

    logger.trace(f"at get_weather_response.endpoint ==> {endpoint}")

    try:
        response = await http_client.get(endpoint)
        response.raise_for_status()
        return response.json()
    except httpx.HTTPStatusError:
        # Specific HTTP errors (like 404 Not Found, 500 Server Error)
        return None
    except httpx.TimeoutException:
        # Request timed out
        return None
    except httpx.RequestError:
        # Other request errors (connection, DNS, etc.)
        return None
    except json.JSONDecodeError:
        # Response was not valid JSON
        return None
    except Exception:
        # Any other unexpected errors
        return None


def format_alert(feature: dict[str, Any]) -> str:
    """Format an alert feature into a readable string."""

    logger.trace(f"format_alert.feature ==> {feature}")
    props = feature.get("properties", {})
    # Use .get() with default values for robustness
    return f"""
            Event: {props.get("event", "Unknown Event")}
            Area: {props.get("areaDesc", "N/A")}
            Severity: {props.get("severity", "N/A")}
            Certainty: {props.get("certainty", "N/A")}
            Urgency: {props.get("urgency", "N/A")}
            Effective: {props.get("effective", "N/A")}
            Expires: {props.get("expires", "N/A")}
            Description: {props.get("description", "No description provided.").strip()}
            Instructions: {props.get("instruction", "No instructions provided.").strip()}
            """


def format_forecast_period(period: dict[str, Any]) -> str:
    """Formats a single forecast period into a readable string."""

    logger.trace(f"format_forecast_period.period ==> {period}")
    return f"""
           {period.get("name", "Unknown Period")}:
             Temperature: {period.get("temperature", "N/A")}°{period.get("temperatureUnit", "F")}
             Wind: {period.get("windSpeed", "N/A")} {period.get("windDirection", "N/A")}
             Short Forecast: {period.get("shortForecast", "N/A")}
             Detailed Forecast: {period.get("detailedForecast", "No detailed forecast provided.").strip()}
           """


# --- MCP Tools ---


@mcp.tool()
async def get_alerts(state: str) -> str:
    """
    Get active weather alerts for a specific US state.

    Args:
        state: The two-letter US state code (e.g., CA, NY, TX). Case-insensitive.
    """
    logger.trace(f"get_alerts.state ==> {state}")

    is_invalid_state = (
        not isinstance(state, str) or len(state) != 2 or not state.isalpha()
    )

    if is_invalid_state:
        return "Invalid input. Please provide a two-letter US state code (e.g., CA)."

    state_code = state.upper()

    endpoint = f"/alerts/active/area/{state_code}"
    data = await get_weather_response(endpoint)

    if data is None:
        # Error occurred during request
        return f"Failed to retrieve weather alerts for {state_code}."

    features = data.get("features")
    if not features:  # Handles both null and empty list
        return f"No active weather alerts found for {state_code}."

    alerts = [format_alert(feature) for feature in features]
    return "\n---\n".join(alerts)


@mcp.tool()
async def get_forecast(latitude: float, longitude: float) -> str:
    """Get the weather forecast for a specific location using latitude and longitude.

    Args:
        latitude: The latitude of the location (e.g., 34.05).
        longitude: The longitude of the location (e.g., -118.25).
    """
    logger.trace(f"get_forecast.latitude ==> {latitude} | longitude ==> {longitude}")

    is_invalid_location = not (-90 <= latitude <= 90 and -180 <= longitude <= 180)
    if is_invalid_location:
        return "Invalid latitude or longitude provided. Latitude must be between -90 and 90, Longitude between -180 and 180."

    # NWS API requires latitude,longitude format with up to 4 decimal places
    point_endpoint = f"/points/{latitude:.4f},{longitude:.4f}"
    points_data = await get_weather_response(point_endpoint)

    if points_data is None or "properties" not in points_data:
        return f"Unable to retrieve NWS gridpoint information for {latitude:.4f},{longitude:.4f}."

    # Extract forecast URLs from the gridpoint data
    forecast_url = points_data["properties"].get("forecast")

    if not forecast_url:
        return f"Could not find the NWS forecast endpoint for {latitude:.4f},{longitude:.4f}."

    logger.trace(f"get_forecast.forecast_url ==> {forecast_url}")

    # Make the request to the specific forecast URL
    forecast_data = None
    try:
        response = await http_client.get(forecast_url)
        response.raise_for_status()
        forecast_data = response.json()
    except httpx.HTTPStatusError:
        pass  # Error handled by returning None below
    except httpx.RequestError:
        pass  # Error handled by returning None below
    except json.JSONDecodeError:
        pass  # Error handled by returning None below
    except Exception:
        pass  # Error handled by returning None below

    if forecast_data is None or "properties" not in forecast_data:
        return "Failed to retrieve detailed forecast data from NWS."

    periods = forecast_data["properties"].get("periods")
    if not periods:
        return "No forecast periods found for this location from NWS."

    # Format the first 5 periods
    forecasts = [format_forecast_period(period) for period in periods[:5]]

    return "\n---\n".join(forecasts)


@mcp.tool()
async def get_forecast_by_city(city: str, state: str) -> str:
    """Get the weather forecast for a specific US city and state by first finding its coordinates.

    Args:
        city: The name of the city (e.g., "Los Angeles", "New York").
        state: The two-letter US state code (e.g., CA, NY). Case-insensitive.
    """
    logger.trace(f"get_forecast_by_city.city ==> {city} | state ==> {state}")

    # --- Input Validation ---
    is_invalid_city = not city or not isinstance(city, str)
    if is_invalid_city:
        return "Invalid city name provided."

    is_invalid_state = (
        not state
        or not isinstance(state, str)
        or len(state) != 2
        or not state.isalpha()
    )
    if is_invalid_state:
        return "Invalid state code. Please provide the two-letter US state abbreviation (e.g., CA)."

    city_name = city.strip()
    state_code = state.strip().upper()
    # Construct a query likely to yield a US result
    query = f"{city_name}, {state_code}, USA"

    # --- Geocoding ---
    location = None
    try:
        # Synchronous geocode call
        location = geolocator.geocode(query, timeout=GEOCODE_TIMEOUT)

    except GeocoderTimedOut:
        return f"Could not get coordinates for '{city_name}, {state_code}': The location service timed out."
    except GeocoderServiceError:
        return f"Could not get coordinates for '{city_name}, {state_code}': The location service returned an error."
    except Exception:
        # Catch any other unexpected errors during geocoding
        return f"An unexpected error occurred while finding coordinates for '{city_name}, {state_code}'."

    # --- Handle Geocoding Result ---
    if location is None:
        return f"Could not find coordinates for '{city_name}, {state_code}'. Please check the spelling or try a nearby city."

    latitude = location.latitude
    longitude = location.longitude

    # --- Reuse existing forecast logic with obtained coordinates ---
    return await get_forecast(latitude, longitude)


# --- Server Execution & Shutdown ---
async def shutdown_event():
    """Gracefully close the httpx client."""
    await http_client.aclose()


if __name__ == "__main__":
    mcp.run(transport="stdio")
