const fs = require('fs');
const readline = require('readline');

const logFile = 'C:\\Users\\pc\\.gemini\\antigravity\\brain\\82d36713-a38b-4414-801d-2441bacaf857\\.system_generated\\logs\\transcript_full.jsonl';

async function find() {
  const fileStream = fs.createReadStream(logFile);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  console.log("Searching for VITE_SUPABASE_URL in transcript_full.jsonl...");

  for await (const line of rl) {
    if (line.includes('VITE_SUPABASE_URL') && line.includes('wgorrkrfpbknufkilva')) {
      console.log("Line matched:");
      console.log(line);
      break;
    }
  }
}

find();
