import dotenv from 'dotenv';
dotenv.config();
import { resolveSkyPlaceIds } from '@/services/search/skyPlaceResolver';

async function testResolver() {
  const apiKey = process.env.RAPID_API_KEY;
  const apiHost = 'flights-scraper-real-time.p.rapidapi.com';

  console.log('🔍 Testing Sky Place Resolver...\n');

  try {
    const result = await resolveSkyPlaceIds('BNE', 'IST', '2026-03-15', apiKey!, apiHost);
    console.log('✅ Resolution succeeded:');
    console.log(`   From: ${result.from}`);
    console.log(`   To: ${result.to}`);
  } catch (error: any) {
    console.error('❌ Resolution failed:');
    console.error(error.message);
  }
}

testResolver().catch(console.error);
