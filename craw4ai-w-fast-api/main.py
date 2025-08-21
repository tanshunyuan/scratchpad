from fastapi import FastAPI
from fastapi import FastAPI, HTTPException, status
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from models import ScrapeRequest, ScrapeResponse, ErrorResponse
from scraper import scrape_website, ScrapingError, URLNotFoundError, InvalidURLError
import uvicorn
from loguru import logger

app = FastAPI()


@app.get("/")
def read_root():
    return {"Hello": "World"}

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure as needed for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health", 
         summary="Health Check",
         description="Simple health check endpoint to verify the server is running")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "web-scraper-api"}

@app.post("/scrape",
          response_model=ScrapeResponse,
          summary="Scrape Website",
          description="Scrape a website and return its content in markdown format",
          responses={
              200: {"description": "Successfully scraped website", "model": ScrapeResponse},
              400: {"description": "Bad request - invalid URL or parameters", "model": ErrorResponse},
              404: {"description": "URL not found or not accessible", "model": ErrorResponse},
              500: {"description": "Internal server error during scraping", "model": ErrorResponse}
          })
async def scrape_endpoint(request: ScrapeRequest):
    """
    Scrape a website using crawl4ai
    
    Args:
        request: ScrapeRequest containing URL and optional configuration parameters
        
    Returns:
        ScrapeResponse with scraped content in markdown format
        
    Raises:
        HTTPException: For various error conditions with appropriate status codes
    """
    try:
        logger.info(f"Received scraping request for URL: {request.url}")
        
        # Validate request parameters
        if request.max_depth and request.max_depth > 5:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="max_depth cannot exceed 5"
            )
        
        if request.max_pages and request.max_pages > 50:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="max_pages cannot exceed 50"
            )
        
        # Perform scraping
        result = await scrape_website(request)
        
        logger.info(f"Successfully completed scraping for {request.url}")
        return result
        
    except InvalidURLError as e:
        logger.error(f"Invalid URL error: {e.message}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=e.message
        )
    
    except URLNotFoundError as e:
        logger.error(f"URL not found error: {e.message}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=e.message
        )
    
    except ScrapingError as e:
        logger.error(f"Scraping error: {e.message}")
        raise HTTPException(
            status_code=e.status_code,
            detail=e.message
        )
    
    except Exception as e:
        logger.error(f"Unexpected error in scrape endpoint: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An unexpected error occurred: {str(e)}"
        )

@app.exception_handler(HTTPException)
async def http_exception_handler(request, exc: HTTPException):
    """Custom HTTP exception handler"""
    error_response = ErrorResponse(
        success=False,
        error="HTTPException",
        message=exc.detail,
        status_code=exc.status_code
    )
    return JSONResponse(
        status_code=exc.status_code,
        content=error_response.dict()
    )

@app.exception_handler(Exception)
async def general_exception_handler(request, exc: Exception):
    """General exception handler for unhandled exceptions"""
    logger.error(f"Unhandled exception: {str(exc)}")
    error_response = ErrorResponse(
        success=False,
        error="InternalServerError",
        message="An internal server error occurred",
        status_code=500
    )
    return JSONResponse(
        status_code=500,
        content=error_response.dict()
    )

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,  # Set to False in production
        log_level="info"
    )

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,  # Set to False in production
        log_level="info"
    )
