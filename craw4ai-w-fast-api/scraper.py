import asyncio
from typing import List
from crawl4ai import AsyncWebCrawler, CrawlerRunConfig
from crawl4ai.deep_crawling import BFSDeepCrawlStrategy
from crawl4ai.content_scraping_strategy import LXMLWebScrapingStrategy
from crawl4ai.markdown_generation_strategy import DefaultMarkdownGenerator
from crawl4ai.content_filter_strategy import PruningContentFilter
from models import ScrapeRequest, PageResult, ScrapeResponse
from loguru import logger

class ScrapingError(Exception):
    """Custom exception for scraping errors"""
    def __init__(self, message: str, status_code: int = 500):
        self.message = message
        self.status_code = status_code
        super().__init__(self.message)

class URLNotFoundError(ScrapingError):
    """Exception for URL not found errors"""
    def __init__(self, message: str):
        super().__init__(message, 404)

class InvalidURLError(ScrapingError):
    """Exception for invalid URL errors"""
    def __init__(self, message: str):
        super().__init__(message, 400)

async def scrape_website(request: ScrapeRequest) -> ScrapeResponse:
    """
    Scrape a website using crawl4ai with the provided configuration
    
    Args:
        request: ScrapeRequest containing URL and configuration options
        
    Returns:
        ScrapeResponse containing the scraped results
        
    Raises:
        ScrapingError: For various scraping failures
        URLNotFoundError: When URL is not accessible
        InvalidURLError: When URL format is invalid
    """
    try:
        # Convert pydantic HttpUrl to string
        url_str = str(request.url)
        
        logger.info(f"Starting to scrape URL: {url_str}")
        logger.info(f"Configuration: max_depth={request.max_depth}, max_pages={request.max_pages}")
        
        # Configure deep crawling strategy
        deep_crawl_config = BFSDeepCrawlStrategy(
            max_depth=request.max_depth,
            include_external=request.include_external,
            max_pages=request.max_pages
        )
        
        # Configure markdown generator with content filter
        md_generator = DefaultMarkdownGenerator(
            content_filter=PruningContentFilter(
                threshold=request.content_filter_threshold, 
                threshold_type="fixed"
            ),
            options={
                "ignore_links": True,
                "escape_html": False,
                "body_width": 80
            }
        )
        
        # Create crawler configuration
        config = CrawlerRunConfig(
            deep_crawl_strategy=deep_crawl_config,
            scraping_strategy=LXMLWebScrapingStrategy(),
            verbose=True,
            markdown_generator=md_generator
        )
        
        # Perform the crawling
        async with AsyncWebCrawler() as crawler:
            try:
                results = await crawler.arun(url_str, config=config)
                logger.info(f"Crawled {len(results)} pages in total")
                
                if not results:
                    raise URLNotFoundError(f"No content could be retrieved from URL: {url_str}")
                
                # Process results
                page_results = []
                successful_pages = 0
                
                for result in results:
                    page_result = PageResult(
                        url=result.url if hasattr(result, 'url') else url_str,
                        markdown=result.markdown if result.success and hasattr(result, 'markdown') else "",
                        success=result.success,
                        error_message=result.error_message if not result.success else None
                    )
                    page_results.append(page_result)
                    
                    if result.success:
                        successful_pages += 1
                
                # Create response
                response = ScrapeResponse(
                    success=successful_pages > 0,
                    pages_crawled=len(results),
                    results=page_results,
                    message=f"Successfully scraped {successful_pages} out of {len(results)} pages"
                )
                
                if successful_pages == 0:
                    raise ScrapingError("No pages could be successfully scraped", 500)
                
                return response
                
            except Exception as crawler_error:
                logger.error(f"Crawler error: {str(crawler_error)}")
                
                # Handle specific crawler errors
                error_msg = str(crawler_error).lower()
                if "not found" in error_msg or "404" in error_msg:
                    raise URLNotFoundError(f"URL not found: {url_str}")
                elif "connection" in error_msg or "timeout" in error_msg:
                    raise ScrapingError(f"Connection failed for URL: {url_str}", 500)
                elif "invalid" in error_msg or "malformed" in error_msg:
                    raise InvalidURLError(f"Invalid URL format: {url_str}")
                else:
                    raise ScrapingError(f"Failed to crawl URL {url_str}: {str(crawler_error)}", 500)
                    
    except (URLNotFoundError, InvalidURLError, ScrapingError):
        # Re-raise custom exceptions
        raise
    except Exception as e:
        logger.error(f"Unexpected error during scraping: {str(e)}")
        raise ScrapingError(f"Unexpected error occurred: {str(e)}", 500)