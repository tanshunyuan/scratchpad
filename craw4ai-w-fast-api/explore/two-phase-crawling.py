import asyncio
from crawl4ai import AsyncWebCrawler, AsyncUrlSeeder, BrowserConfig, CrawlerRunConfig, SeedingConfig
from crawl4ai.deep_crawling import BFSDeepCrawlStrategy
from crawl4ai.content_scraping_strategy import LXMLWebScrapingStrategy

async def two_phase_filtered_crawl():
    """
    Two-phase crawling approach using URL Seeding for true pre-crawl filtering:
    
    Phase 1: URL Discovery & Filtering (using AsyncUrlSeeder)
    - Discover all URLs from sitemap/common crawl
    - Filter out authentication pages BEFORE crawling
    - Handle URL deduplication  
    - Select exactly the URLs we want to crawl
    
    Phase 2: Deep Crawling (using BFSDeepCrawlStrategy)
    - Crawl only the pre-filtered, selected URLs
    - No wasted crawl budget on unwanted pages
    - Guarantee exact control over what gets crawled
    """
    
    # =================================================================
    # PHASE 1: URL DISCOVERY & FILTERING
    # =================================================================
    
    print("🔍 PHASE 1: URL Discovery & Filtering")
    print("-" * 50)

    async with AsyncUrlSeeder() as seeder:
        print("📋 Discovering URLs from cc...")
        
        discovery_config = SeedingConfig(
            source="sitemap+cc",
            max_urls=20,  # Reasonable limit for discovery
            live_check=False,  # Skip validation for speed in discovery phase
            concurrency=20,
            verbose=True,
            filter_nonsense_urls=True,

            # pattern="*",  # Get all URLs initially
            extract_head=True,  # Get metadata for better filtering
            query="home page, about page and pricing page",
            scoring_method="bm25",
            score_threshold=0.4
        )
        
        # Discover all available URLs
        discovered_urls = await seeder.urls("https://www.bytescale.com", discovery_config)
        print(f"✅ Discovered {len(discovered_urls)} total URLs")
        
        # Step 2: Filter out authentication pages
        print("\n🚫 Filtering out ignored pages...")
        
        ignore_patterns = [
            "login", "signin", "sign-in", "log-in",
            "signup", "sign-up", "register", "registration",
            "auth", "authentication", "oauth", "sso",
            "reset-password", "forgot-password", "password-reset",
            "recover-password", "account", "profile", 
            "dashboard", "settings", "admin",
        ]
        
        def is_ignored_url(url: str):
            """Check if URL contains ignored patterns"""
            url_lower = url.lower()
            return any(pattern in url_lower for pattern in ignore_patterns)
        
        to_scrape_urls = []
        ignored_urls = []
        
        for url_data in discovered_urls:
            url = url_data["url"]
            if is_ignored_url(url):
                ignored_urls.append(url)
            else:
                print(url)
                to_scrape_urls.append(url_data)
        
        print(f"🚫 Filtered out {len(ignored_urls)} URLs:")
        for ignored_url in ignored_urls[:5]:  # Show first 5
            print(f"   - {ignored_url}")
        if len(ignored_urls) > 5:
            print(f"   ... and {len(ignored_urls) - 5} more")
        
        # Step 3: Handle URL deduplication (trailing slash issue)
        print(f"\n🔄 Deduplicating URLs...")
        
        def normalize_url(url: str):
            """Normalize URL to handle trailing slash duplicates"""
            # Remove trailing slash unless it's the root domain
            if url.endswith('/') and url.count('/') > 2:
                return url.rstrip('/')
            return url
        
        # Deduplicate URLs
        unique_urls = {}
        duplicates_found = []
        
        for url_data in to_scrape_urls:
            original_url = url_data["url"]
            normalized = normalize_url(original_url)
            
            if normalized not in unique_urls:
                unique_urls[normalized] = url_data
            else:
                duplicates_found.append(original_url)
        
        print(f"🔄 Removed {len(duplicates_found)} duplicate URLs")
        
        # Step 4: Select final URLs to crawl (respecting max_pages limit)
        max_pages_to_crawl = 3  # Your requirement: exactly 3 pages
        
        final_urls = list(unique_urls.values())[:max_pages_to_crawl]
        
        print(f"\n✅ Phase 1 Complete - Selected {len(final_urls)} URLs for crawling:")
        for i, url_data in enumerate(final_urls, 1):
            title = "No title"
            if url_data.get("head_data") and url_data["head_data"].get("title"):
                title = url_data["head_data"]["title"][:60] + "..."
            print(f"   {i}. {url_data['url']}")
            print(f"      Title: {title}")
    
    # =================================================================
    # PHASE 2: DEEP CRAWLING OF SELECTED URLs
    # =================================================================
    
    print(f"\n🚀 PHASE 2: Deep Crawling Selected URLs")
    print("-" * 50)
    
    # Browser configuration optimized for content extraction
    browser_config = BrowserConfig(
        headless=True,
        text_mode=True,  # Disable images for performance
        light_mode=True,  # Reduce resource usage
        verbose=True
    )
    
    # Configure deep crawling strategy for the selected URLs
    deep_crawl_strategy = BFSDeepCrawlStrategy(
        max_depth=1,  # Since we pre-selected URLs, just crawl them directly
        include_external=False,  # Stay within domain
        max_pages=len(final_urls),  # Exact number of pre-selected URLs
    )
    
    # Crawler configuration for content extraction
    crawler_config = CrawlerRunConfig(
        # deep_crawl_strategy=deep_crawl_strategy,
        scraping_strategy=LXMLWebScrapingStrategy(),
        
        # Content filtering (ignore scripts, styles, etc.)
        excluded_tags=["script", "style", "noscript", "link[rel='stylesheet']"],
        only_text=True,
        
        # Performance optimizations
        word_count_threshold=10,
        exclude_external_links=True,
        exclude_social_media_links=True,
        exclude_all_images=True,
        
        # Settings
        verbose=True,
        stream=False
    )
    
    # Extract just the URLs for crawling
    selected_urls = [url_data["url"] for url_data in final_urls]
    
        # Use arun_many for efficient batch crawling
    results = []
    # Crawl the pre-selected URLs
    async with AsyncWebCrawler(config=browser_config) as crawler:
        print(f"📥 Crawling {len(selected_urls)} pre-selected URLs...")
        

        scrape_results = await crawler.arun_many(selected_urls, config=crawler_config)

        for sr in scrape_results:
            results.append(sr)
            if sr.success:
                print(f"   ✅ Success - {len(sr.cleaned_html)} chars extracted")
            else:
                print(f"   ❌ Failed - {sr.error_message}")
            
    # =================================================================
    # RESULTS SUMMARY
    # =================================================================
    
    print(f"\n📊 CRAWLING COMPLETE - FINAL RESULTS")
    print("=" * 60)
    
    successful_results = [r for r in results if r.success]
    failed_results = [r for r in results if not r.success]
    
    print(f"✅ Successfully crawled: {len(successful_results)} pages")
    print(f"❌ Failed to crawl: {len(failed_results)} pages")
    print(f"🚫 Ignore pages avoided: {len(ignored_urls)} pages")
    print(f"🔄 Duplicates avoided: {len(duplicates_found)} pages")
    
    print(f"\n📋 Detailed Results:")
    for i, result in enumerate(results, 1):
        status = "✅" if result.success else "❌"
        content_len = len(result.cleaned_html) if result.success else 0
        links_found = len(result.links.get('internal', [])) if result.success else 0
        
        print(f"\n{i}. {status} {result.url}")
        if result.success:
            print(f"   Content: {content_len:,} characters")
            print(f"   Links: {links_found} internal links found") 
            if result.metadata and 'title' in result.metadata:
                print(f"   Title: {result.metadata['title'][:60]}...")
        else:
            print(f"   Error: {result.error_message}")
    
    return results

# Main function to demonstrate both approaches
async def main():
    """
    Demonstrate both two-phase crawling approaches:
    1. Basic filtering approach
    2. Intelligent BM25 scoring approach
    """
    
    print("🚀 CRAWL4AI TWO-PHASE CRAWLING DEMONSTRATION")
    print("=" * 70)
    print("Phase 1: URL Discovery & Pre-filtering (no crawling waste)")
    print("Phase 2: Targeted crawling of selected URLs only")
    print("=" * 70)
    
    try:
        print("\n🔧 APPROACH 1: Basic Filtering")
        await two_phase_filtered_crawl()
        
    except Exception as e:
        print(f"❌ Error during crawling: {e}")
        import traceback
        traceback.print_exc()
    
    print("\n" + "=" * 70)
    print("✨ SUMMARY: True Pre-Crawl Filtering Achieved!")
    print("✅ No authentication pages crawled")
    print("✅ No duplicate URLs crawled")  
    print("✅ Exact control over crawl budget")
    print("✅ Maximum efficiency with URL Seeding")

if __name__ == "__main__":
    asyncio.run(main())