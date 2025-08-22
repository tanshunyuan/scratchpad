from crawl4ai import AsyncWebCrawler, AdaptiveCrawler, AdaptiveConfig
import asyncio

async def main():
    async with AsyncWebCrawler() as crawler:
        config = AdaptiveConfig(
            confidence_threshold=0.8,    # Stop when 80% confident (default: 0.7)
            max_pages=30,               # Maximum pages to crawl (default: 20)
            top_k_links=5,              # Links to follow per page (default: 3)
            min_gain_threshold=0.05     # Minimum expected gain to continue (default: 0.1)
        )
        # Create an adaptive crawler (config is optional)
        adaptive = AdaptiveCrawler(crawler, config=config)

        # Start crawling with a query
        result = await adaptive.digest(
            start_url="https://docs.python.org/3/",
            query="async context managers"
        )

        # View statistics
        adaptive.print_stats()

        # Get the most relevant content
        relevant_pages = adaptive.get_relevant_content(top_k=5)
        for page in relevant_pages:
            print(f"- {page['url']} (score: {page['score']:.2f})")

if __name__ == "__main__":
    asyncio.run(main())