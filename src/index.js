export default {
  // ১. ক্রন জব - Stooq থেকে ডেটা আনা
  async scheduled(event, env, ctx) {
    // এখানে আপনার স্টকের লিংক দিন (যেমন AAPL)
    const stooqUrl = "https://stooq.com/q/l/?s=aapl.us&f=sd2t2ohlcv&h&e=csv";
    
    // বট প্রোটেকশন বাইপাস করার জন্য রিয়েল ব্রাউজার হেডার্স
    const headers = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      "Accept": "text/csv,application/csv,text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9,bn;q=0.8",
      "Accept-Encoding": "gzip, deflate, br",
      "Connection": "keep-alive",
      "Upgrade-Insecure-Requests": "1",
      "Sec-Fetch-Dest": "document",
      "Sec-Fetch-Mode": "navigate",
      "Sec-Fetch-Site": "none",
      "Sec-Fetch-User": "?1",
      "Cache-Control": "max-age=0"
    };

    try {
      // fetch রিকোয়েস্টে cacheTtl: 0 দেওয়া হয়েছে যাতে সবসময় ফ্রেশ ডেটা আনে
      const response = await fetch(stooqUrl, { 
        headers,
        cf: { cacheTtl: 0 }
      });

      if (response.ok) {
        const textData = await response.text();
        
        // ভেরিফিকেশন: চেক করা হচ্ছে স্টুক কোনো ক্যাপচা বা HTML পেজ দিয়েছে কি না
        // সাধারণত CSV ফাইলে "<html" ট্যাগ থাকে না
        if (textData.toLowerCase().includes("<html") || textData.toLowerCase().includes("captcha")) {
          console.error("Blocked by Stooq! Received HTML instead of CSV. Skipping save to protect old data.");
          return;
        }

        // ডেটা সঠিক হলে KV তে সেভ করবে
        await env.STOOQ_KV.put("latest_csv", textData);
        console.log("Data fetched and saved successfully at", new Date().toISOString());
      } else {
        console.error("Fetch failed with status:", response.status);
      }
    } catch (error) {
      console.error("Worker Error:", error.message);
    }
  },

  // ২. পাবলিক আউটপুট - URL ভিজিট করলে ডেটা দেখাবে
  async fetch(request, env, ctx) {
    // শুধুমাত্র GET রিকোয়েস্ট অ্যালাউ করা
    if (request.method !== "GET") {
      return new Response("Method Not Allowed", { status: 405 });
    }

    const data = await env.STOOQ_KV.get("latest_csv");

    if (!data) {
      return new Response("No data available yet. Please wait for the cron job to run.", { 
        status: 404,
        headers: { "Content-Type": "text/plain" }
      });
    }

    return new Response(data, {
      headers: {
        "Content-Type": "text/csv",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-cache"
      },
    });
  },
};
  
