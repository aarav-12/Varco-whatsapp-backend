# Varco WhatsApp Backend
Webhook receiver for Tally forms → Supabase

## Setup

1. Install dependencies:
	npm install
2. Create a .env file in the project root:
	SUPABASE_URL=https://your-project-ref.supabase.co
	SUPABASE_KEY=your-supabase-service-or-anon-key
3. Start the backend:
	node index.js

If SUPABASE_URL or SUPABASE_KEY is missing, the server still starts, but Supabase-backed routes return a configuration error.
