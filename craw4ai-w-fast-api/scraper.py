import asyncio
from typing import List
from crawl4ai import AsyncWebCrawler, CrawlerRunConfig, BrowserConfig
from crawl4ai.deep_crawling import BFSDeepCrawlStrategy, BestFirstCrawlingStrategy
from crawl4ai.deep_crawling.scorers import KeywordRelevanceScorer
from crawl4ai.deep_crawling.filters import FilterChain, URLPatternFilter, DomainFilter
from crawl4ai.content_scraping_strategy import LXMLWebScrapingStrategy
from crawl4ai.markdown_generation_strategy import DefaultMarkdownGenerator
from crawl4ai.content_filter_strategy import PruningContentFilter
from models import ScrapeRequest, PageResult, ScrapeResponse
from loguru import logger
import tldextract


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


def normalize_url(url: str):
    """
    Helper function to normalize URLs and avoid trailing slash duplication.
    This can be used to preprocess URLs before crawling.
    """
    # Remove trailing slash unless it's the root domain
    if url.endswith("/") and url.count("/") > 2:
        url = url.rstrip("/")
    return url


class CustomURLFilter:
    """Custom URL filter that should work more reliably"""

    def __init__(self, exclude_patterns: list[str]):
        self.exclude_patterns = [p.replace("*", "") for p in exclude_patterns]

    def should_exclude_url(self, url: str):
        """Check if URL should be excluded based on patterns"""
        url_lower = url.lower()
        for pattern in self.exclude_patterns:
            if pattern.lower() in url_lower:
                return True
        return False


async def scrape_website(request: ScrapeRequest) -> ScrapeResponse:
    try:
        print(f"request.url {request.url}")
        # Convert pydantic HttpUrl to string
        url_str = normalize_url(str(request.url))

        logger.info(f"Starting to scrape URL: {url_str}")
        logger.info(
            f"Configuration: max_depth={request.max_depth}, max_pages={request.max_pages}"
        )


        common_page_patterns = [
            "*about*",  # About pages (about, about-us, about-company, etc.)
            "*contact*",  # Contact pages (contact, contact-us, etc.)
            "*service*",  # Services pages (services, our-services, etc.)
            "*home*",  # Alternative home pages
            "*company*",  # Company information pages
            "*team*",  # Team/staff pages
            "*mission*",  # Mission/vision pages
            "*history*",  # Company history pages
            "*overview*",  # Overview pages
        ]
        inclusion_filter = URLPatternFilter(patterns=common_page_patterns, use_glob=True)

        extracted = tldextract.extract(url=url_str)
        domain = f"{extracted.domain}.{extracted.suffix}"
        allowed_domains = DomainFilter(
            allowed_domains=[domain]
        )
        filter_chain = FilterChain([inclusion_filter, allowed_domains])

        # Configure deep crawling strategy
        deep_crawl_config = BFSDeepCrawlStrategy(
            include_external=False,
            filter_chain=filter_chain,
            max_depth=request.max_depth,
            max_pages=request.max_pages,
        )

        # Configure markdown generator with content filter
        md_generator = DefaultMarkdownGenerator(
            content_source="cleaned_html",
            # see https://docs.crawl4ai.com/core/markdown-generation/#52-pruningcontentfilter
            content_filter=PruningContentFilter(threshold=0.5, threshold_type="fixed"),
            options={"ignore_links": True, "escape_html": False, "body_width": 80},
        )

        # Create crawler configuration
        crawler_config = CrawlerRunConfig(
            deep_crawl_strategy=deep_crawl_config,
            markdown_generator=md_generator,
            scraping_strategy=LXMLWebScrapingStrategy(),
            word_count_threshold=3,
            verbose=True,
            exclude_external_links=True,
            exclude_internal_links=True,
            exclude_all_images=True,
            only_text=True,
            exclude_social_media_links=True,
            excluded_tags=["script", "style"],
            # target_elements=["h1", "h2", "h3", "h4", "h5", "h6", "p"],
            wait_until="domcontentloaded",
        )

        browser_config = BrowserConfig(
            headless=True,
            text_mode=True,
            light_mode=True,
            verbose=False,
        )

        async with AsyncWebCrawler(config=browser_config) as crawler:
            try:
                results = await crawler.arun(url_str, config=crawler_config)
                logger.info(f"Crawled {len(results)} pages in total")

                if not results:
                    raise URLNotFoundError(
                        f"No content could be retrieved from URL: {url_str}"
                    )

                # Process results
                page_results = []
                successful_pages = 0

                for result in results:
                    page_result = PageResult(
                        url=result.url if hasattr(result, "url") else url_str,
                        markdown=(
                            result.markdown.fit_markdown
                            if result.success and hasattr(result, "markdown")
                            else ""
                        ),
                        success=result.success,
                        error_message=(
                            result.error_message if not result.success else None
                        ),
                    )
                    page_results.append(page_result)

                    if result.success:
                        successful_pages += 1

                # Create response
                response = ScrapeResponse(
                    success=successful_pages > 0,
                    pages_crawled=len(results),
                    results=page_results,
                    message=f"Successfully scraped {successful_pages} out of {len(results)} pages",
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
                    raise ScrapingError(
                        f"Failed to crawl URL {url_str}: {str(crawler_error)}", 500
                    )

    except (URLNotFoundError, InvalidURLError, ScrapingError):
        # Re-raise custom exceptions
        raise
    except Exception as e:
        logger.error(f"Unexpected error during scraping: {str(e)}")
        raise ScrapingError(f"Unexpected error occurred: {str(e)}", 500)
