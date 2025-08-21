from pydantic import BaseModel, HttpUrl, Field
from typing import List, Optional

class ScrapeRequest(BaseModel):
    url: HttpUrl = Field(..., description="The URL to scrape")
    max_depth: Optional[int] = Field(default=2, ge=1, le=5, description="Maximum crawling depth")
    max_pages: Optional[int] = Field(default=10, ge=1, le=50, description="Maximum number of pages to crawl")
    # content_filter_threshold: Optional[float] = Field(default=0.4, ge=0.0, le=1.0, description="Content filtering threshold")
    # include_external: Optional[bool] = Field(default=False, description="Whether to include external links")

class PageResult(BaseModel):
    url: str = Field(..., description="The URL of the scraped page")
    markdown: str = Field(..., description="The markdown content of the page")
    success: bool = Field(..., description="Whether the page was successfully scraped")
    error_message: Optional[str] = Field(default=None, description="Error message if scraping failed")

class ScrapeResponse(BaseModel):
    success: bool = Field(..., description="Whether the overall scraping operation was successful")
    pages_crawled: int = Field(..., description="Total number of pages crawled")
    results: List[PageResult] = Field(..., description="List of scraped page results")
    message: Optional[str] = Field(default=None, description="Additional information about the scraping operation")

class ErrorResponse(BaseModel):
    success: bool = Field(default=False, description="Always false for error responses")
    error: str = Field(..., description="Error type or category")
    message: str = Field(..., description="Detailed error message")
    status_code: int = Field(..., description="HTTP status code")