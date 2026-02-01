import { generateFallbackCandidates } from "../lib/recommendation/fallback-generator";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

async function main() {
  const entertainment = generateFallbackCandidates({
    category: "entertainment",
    locale: "zh",
    count: 5,
    client: "web",
    excludeTitles: [],
    userHistory: [],
    userPreference: { tags: ["悬疑", "解谜"] },
  });

  assert(entertainment.length > 0 && entertainment.length <= 5, "entertainment fallback count invalid");
  const entertainmentTypes = new Set(entertainment.map((r) => r.entertainmentType).filter(Boolean));
  assert(entertainmentTypes.has("video"), "entertainment fallback missing video");
  assert(entertainmentTypes.has("game"), "entertainment fallback missing game");
  assert(entertainmentTypes.has("music"), "entertainment fallback missing music");
  assert(entertainmentTypes.has("review"), "entertainment fallback missing review");

  const fitness = generateFallbackCandidates({
    category: "fitness",
    locale: "zh",
    count: 5,
    client: "web",
    excludeTitles: [],
    userHistory: [],
    userPreference: { tags: ["力量训练", "附近"] },
  });

  assert(fitness.length > 0 && fitness.length <= 5, "fitness fallback count invalid");
  const fitnessTypes = new Set(fitness.map((r) => r.fitnessType).filter(Boolean));
  assert(fitnessTypes.has("nearby_place"), "fitness fallback missing nearby_place");
  assert(fitnessTypes.has("tutorial"), "fitness fallback missing tutorial");
  assert(fitnessTypes.has("equipment"), "fitness fallback missing equipment");

  console.log("Fallback generator verification passed");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

