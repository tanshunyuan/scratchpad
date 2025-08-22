import asyncio
from crawl4ai import AsyncWebCrawler, CrawlerRunConfig
from crawl4ai.deep_crawling import BFSDeepCrawlStrategy
from crawl4ai.content_scraping_strategy import LXMLWebScrapingStrategy
from crawl4ai.markdown_generation_strategy import DefaultMarkdownGenerator
from crawl4ai.content_filter_strategy import PruningContentFilter

async def main():
    deep_crawl_config = BFSDeepCrawlStrategy(
        max_depth=2,
        include_external=False,
        max_pages=10
    )
    md_generator = DefaultMarkdownGenerator(
        content_filter=PruningContentFilter(threshold=0.4, threshold_type="fixed"),
        options={
            "ignore_links": True,
            "escape_html": False,
            "body_width": 80
        }
    )
    config = CrawlerRunConfig(
        deep_crawl_strategy=deep_crawl_config,
        scraping_strategy=LXMLWebScrapingStrategy(),
        verbose=True,
        markdown_generator=md_generator
    )

    async with AsyncWebCrawler() as crawler:
        results = await crawler.arun("https://nvchad.com/docs/quickstart/install", config=config)
        print(f"Crawled {len(results)} pages in total")

        # Access individual results
        for result in results[:3]:  # Show first 3 results
            if result.success:
                print("Markdown:\n", result.markdown.fit_markdown[:500])
            else:
                print("Crawl failed:", result.error_message)
            print('----')

if __name__ == "__main__":
    asyncio.run(main())
