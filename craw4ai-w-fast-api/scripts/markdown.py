import asyncio
from crawl4ai import AsyncWebCrawler, BrowserConfig, CrawlerRunConfig, CacheMode
from crawl4ai.content_filter_strategy import PruningContentFilter
from crawl4ai.markdown_generation_strategy import DefaultMarkdownGenerator

async def main():
    browser_conf = BrowserConfig(headless=True)  # or False to see the browser
    md_generator = DefaultMarkdownGenerator(
        content_filter=PruningContentFilter(threshold=0.4, threshold_type="fixed")
    )

    config = CrawlerRunConfig(
        cache_mode=CacheMode.BYPASS,
        markdown_generator=md_generator
    )

    async with AsyncWebCrawler(config=browser_conf) as crawler:
        result = await crawler.arun("https://news.ycombinator.com", config=config)
        print("Raw Markdown length:", len(result.markdown.raw_markdown))
        print("Fit Markdown length:", len(result.markdown.fit_markdown))
        print(result.markdown.raw_markdown)

if __name__ == "__main__":
    asyncio.run(main())
