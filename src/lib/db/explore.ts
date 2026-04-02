import { createClient } from "@/lib/supabase/server";

export async function searchCreators(
  query: {
    search?: string;
    niches?: string[];
    markets?: string[];
    platforms?: string[];
    sort?: string;
    page?: number;
    limit?: number;
  } = {}
) {
  const {
    search,
    niches,
    markets,
    platforms,
    sort = "ranking_score",
    page = 1,
    limit = 20,
  } = query;
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  const supabase = await createClient();
  let dbQuery = supabase
    .from("creator_profiles")
    .select("*, profile:profiles(*)", { count: "exact" })
    .eq("profile.status", "approved");

  if (search) {
    dbQuery = dbQuery.textSearch("search_vector", search, {
      type: "websearch",
    });
  }
  if (niches && niches.length > 0) {
    dbQuery = dbQuery.overlaps("niches", niches);
  }
  if (markets && markets.length > 0) {
    dbQuery = dbQuery.overlaps("markets", markets);
  }
  if (platforms && platforms.length > 0) {
    dbQuery = dbQuery.overlaps("platforms", platforms);
  }

  // Sort
  if (sort === "ranking_score") {
    dbQuery = dbQuery.order("ranking_score", { ascending: false });
  } else if (sort === "rating") {
    dbQuery = dbQuery.order("avg_rating", { ascending: false });
  } else if (sort === "newest") {
    dbQuery = dbQuery.order("created_at", { ascending: false });
  } else {
    dbQuery = dbQuery.order("ranking_score", { ascending: false });
  }

  dbQuery = dbQuery.range(from, to);

  const { data, error, count } = await dbQuery;
  if (error) throw error;
  return { data, count };
}

export async function getPublicCreatorProfile(slug: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("creator_profiles")
    .select(
      "*, profile:profiles(full_name, avatar_url, created_at)"
    )
    .eq("slug", slug)
    .eq("profile.status", "approved")
    .single();

  if (error) throw error;
  return data;
}

export async function listPlaybooks() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("playbooks")
    .select("*")
    .eq("published", true)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data;
}

export async function getMarketBenchmarks(
  market: string,
  platform: string,
  niche: string
) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("market_benchmarks")
    .select("*")
    .eq("market", market)
    .eq("platform", platform)
    .eq("niche", niche);

  if (error) throw error;
  return data;
}

export async function getCulturalEvents(market: string, year?: number) {
  const supabase = await createClient();
  const currentYear = year ?? new Date().getFullYear();

  const { data, error } = await supabase
    .from("cultural_calendar")
    .select("*")
    .eq("market", market)
    .gte("date", `${currentYear}-01-01`)
    .lte("date", `${currentYear}-12-31`)
    .order("date", { ascending: true });

  if (error) throw error;
  return data;
}
