export default {
  async fetch(request, env, ctx) {
    // শুধুমাত্র GET রিকোয়েস্ট অ্যালাউ করা হবে
    if (request.method !== "GET") {
      return new Response("Method Not Allowed", { status: 405 });
    }

    // ক্যাশ কি (Cache Key) তৈরি করা
    const cacheUrl = new URL(request.url);
    const cacheKey = new Request(cacheUrl.toString(), request);
    const cache = caches.default;

    // ১. ক্লাউডফ্লেয়ারের ক্যাশে আগের ২ মিনিটের ডেটা আছে কি না চেক করা
    let response = await cache.match(cacheKey);

    if (!response) {
      // ২. ক্যাশে ডেটা না থাকলে (বা ২ মিনিট পার হয়ে গেলে) Stooq থেকে নতুন ডেটা আনবে
      
      // ⚠️ নিচে আপনার কাঙ্ক্ষিত স্টক বা কমোডিটির লিংক দিন
      const stooqUrl = "https://stooq.com/q/l/?s=aapl.us&f=sd2t2ohlcv&h&e=csv";
      
      const headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "text/csv,application/csv,text/html,*/*"
      };

      try {
        const stooqResponse = await fetch(stooqUrl, { headers });

        if (stooqResponse.ok) {
          const textData = await stooqResponse.text();
          
          // বট চেকিং: স্টুক ব্লক করলে বা ক্যাপচা দিলে পুরনো এরর মেসেজ দেখাবে
          if (textData.toLowerCase().includes("<html") || textData.toLowerCase().includes("captcha")) {
            return new Response("Stooq temporarily blocked the request. Please try again in a few minutes.", { status: 502 });
          }

          // ৩. নতুন রেসপন্স তৈরি করা এবং ১২০ সেকেন্ড (২ মিনিট) ক্যাশ করার নির্দেশ দেওয়া
          response = new Response(textData, {
            headers: {
              "Content-Type": "text/csv",
              "Access-Control-Allow-Origin": "*",
              "Cache-Control": "s-maxage=120" // ১২০ সেকেন্ড পর এই ডেটা এক্সপায়ার হবে
            },
          });

          // ৪. ডেটা ক্লাউডফ্লেয়ারের ক্যাশে সেভ করে রাখা
          ctx.waitUntil(cache.put(cacheKey, response.clone()));
        } else {
          return new Response("Error fetching from Stooq. Status: " + stooqResponse.status, { status: 500 });
        }
      } catch (error) {
        return new Response("Worker Error: " + error.message, { status: 500 });
      }
    }

    // ৫. ক্যাশ করা অথবা নতুন আনা ডেটা ইউজারকে দেখানো
    return response;
  },
};
