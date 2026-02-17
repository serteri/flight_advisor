const https = require("https");

// --- BURALARI DOLDUR PATRON ---
const username = "serteri_xwtIX"; 
const password = "AltayCimen2205_"; // Şifreni buraya yaz

const body = {
    source: "google_search", // Amazon değil, Google Search kullanıyoruz
    query: "flights from Brisbane to Istanbul", // Sorgumuz bu
    domain: "com",
    geo_location: "Australia", // Avustralya'dan arıyor gibi yap
    parse: true, // Bize HTML verme, JSON ver
};

const options = {
    hostname: "realtime.oxylabs.io",
    path: "/v1/queries",
    method: "POST",
    headers: {
        "Content-Type": "application/json",
        Authorization: "Basic " + Buffer.from(`${username}:${password}`).toString("base64"),
    },
};

console.log("🦁 Oxylabs Testi Başlıyor...");

const request = https.request(options, (response) => {
    let data = "";

    response.on("data", (chunk) => {
        data += chunk;
    });

    response.on("end", () => {
        try {
            const responseData = JSON.parse(data);
            
            console.log("\n--- SONUÇ GELDİ ---");
            
            // Hata var mı kontrol et
            if (responseData.error) {
                console.log("❌ HATA:", responseData.error);
            } else {
                // İçerik var mı?
                const content = responseData.results[0].content;
                console.log("✅ Başarılı! Veri Tipi:", Object.keys(content));
                
                // Uçuş verisi var mı bakıyoruz (Genelde organic veya knowledge_graph içindedir)
                if (content.results && content.results.organic) {
                    console.log(`✈️ Bulunan Organik Sonuç: ${content.results.organic.length} adet`);
                    console.log("İlk Başlık:", content.results.organic[0].title);
                } else {
                    console.log("⚠️ Veri döndü ama uçuş widget'ı farklı formatta.");
                    console.log(JSON.stringify(content).substring(0, 500)); // Verinin başını görelim
                }
            }
        } catch (e) {
            console.log("❌ JSON Parse Hatası:", e.message);
            console.log("Ham Veri:", data);
        }
    });
});

request.on("error", (error) => {
    console.error("🔥 Bağlantı Hatası:", error);
});

request.write(JSON.stringify(body));
request.end();