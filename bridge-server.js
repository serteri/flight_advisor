const express = require('express');
const { exec } = require('child_process');
const app = express();
const port = 3005; // Ngrok'un bakacağı YENİ port (Gateway ile çakışmasın)

app.use(express.json());

app.post('/v1/chat/completions', (req, res) => {
    try {
        // Gelen isteği güvenli oku
        const messages = req.body.messages;
        if (!messages || !Array.isArray(messages) || messages.length === 0) {
            return res.status(400).json({ error: "Mesaj içeriği eksik." });
        }
        
        // Son mesajı al (Genelde prompt burada olur)
        const userPrompt = messages[messages.length - 1].content;
        
        console.log(`🤖 Vercel'den emir geldi!`);
        
        /* 
           FIX: Windows CLI için Prompt Temizliği
           1. Satır sonlarını (\n) boşluğa çevir.
           2. Çift tırnakları (\") kaçır.
        */
        const flatPrompt = userPrompt.replace(/\r?\n|\r/g, ' ').replace(/\s+/g, ' ').trim();
        const safePrompt = flatPrompt.replace(/"/g, '\\"');
        
        console.log(`📝 Prompt (Temizlenmiş): ${safePrompt.substring(0, 50)}...`);

        /* 
           OpenClaw CLI Komutu:
           --agent main: Ana ajanı hedefle.
           --interactive false: Etkileşim bekleme, sadece çalış ve çık.
        */
        const command = `openclaw agent --agent main --message "${safePrompt}"`; 
        // --json bayrağı varsa ekleyebiliriz ama şimdilik standart çıktı alalım.

        console.log(`🚀 Çalıştırılıyor: ${command}`);

        exec(command, (error, stdout, stderr) => {
            if (error) {
                console.error(`🔥 CLI Hatası: ${error.message}`);
                console.error(`🔴 Stderr: ${stderr}`);
                return res.status(500).json({ error: "Agent çalıştırılamadı", details: stderr });
            }

            console.log("✅ OpenClaw analizini bitirdi.");
            
            // TEMİZLİK OPERASYONU 🧹
            // 1. ANSI Renk Kodlarını Temizle (Terminal renkleri)
            let cleanOutput = stdout.replace(/\u001b\[.*?m/g, '');

            // 2. Sadece JSON kısmını çekip al (İlk '[' ile son ']' arasını bul)
            const firstBracket = cleanOutput.indexOf('[');
            const lastBracket = cleanOutput.lastIndexOf(']');

            if (firstBracket !== -1 && lastBracket !== -1) {
                // Sadece JSON array'ini al, gerisini at (Doctor logları vs.)
                cleanOutput = cleanOutput.substring(firstBracket, lastBracket + 1);
                console.log("✨ JSON temizlendi ve paketlendi.");
            } else {
                console.warn("⚠️ Çıktıda JSON array bulunamadı, ham veri gönderiliyor.");
            }

            // OpenClaw'dan gelen sonucu OpenAI formatına uyduruyoruz
            res.json({
                choices: [{
                    message: {
                        role: "assistant",
                        content: cleanOutput // Artık tertemiz JSON!
                    }
                }]
            });
        });
    } catch (e) {
        console.error("🔥 Sunucu Hatası:", e);
        res.status(500).json({ error: "Sunucu hatası" });
    }
});

app.listen(port, () => {
    console.log(`🚀 Köprü Sunucusu (Bridge Server) Hazır!`);
    console.log(`📡 Dinleniyor: http://localhost:${port}`);
    console.log(`🔗 Ngrok Tüneli: https://excursional-murray-isagogically.ngrok-free.dev -> http://localhost:${port}`);
});
