# Deploy Spark

**Live:** https://spark-mvp-orcin.vercel.app  
**Project:** `janusian/spark-mvp`

Spark lives at `studio/spark`. It needs an OpenAI key on Vercel for generation to work.

## 1. Add your API key locally

```bash
cd spark
copy .env.example .env.local
```

Put your key in `.env.local`:

```env
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini
```

```bash
npm run dev
```

Confirm streaming works at http://localhost:3000

## 2. Deploy to Vercel

In a terminal:

```bash
cd spark
npx vercel login
```

Complete the browser device login when prompted, then:

```bash
npx vercel --prod
```

When asked about env vars (or in the Vercel dashboard → Project → Settings → Environment Variables), add:

- `OPENAI_API_KEY` = your OpenAI key  
- `OPENAI_MODEL` = `gpt-4o-mini` (optional)

Then redeploy if you added env vars after the first deploy:

```bash
npx vercel --prod
```

## 3. Wire the live URL into your bid materials

1. Replace `[PASTE_SPARK_URL]` in `upwork/PROPOSAL.md`
2. Update the **Live Demo** link in `src/spark.html` (`#spark-live`)
3. Redeploy the portfolio (Netlify) so clients see Spark first

## 4. Optional: push Spark as its own GitHub repo

If you want a clean public repo for Upwork:

```bash
cd spark
git init
git add .
git commit -m "Ship Spark idea-to-MVP assistant with streaming OpenAI API"
# create repo on GitHub, then:
git remote add origin https://github.com/EkiyorClifford/spark.git
git push -u origin main
```
