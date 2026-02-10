import { describe, expect, it } from "vitest";
import { buildSystemPrompt } from "./tool-definitions";

describe("buildSystemPrompt INTL platform rules", () => {
  it("uses INTL web catalog for web context", () => {
    const prompt = buildSystemPrompt("INTL", "en", false, false, false);

    expect(prompt).toContain("Available Platforms (International - Web)");
    expect(prompt).toContain("IMDb");
    expect(prompt).not.toContain("Amazon Shopping");
    expect(prompt).toContain(
      "In INTL web context, platforms must come strictly from the INTL web catalog above."
    );
  });

  it("uses INTL Android mobile app catalog for android mobile context", () => {
    const prompt = buildSystemPrompt("INTL", "en", false, true, true);

    expect(prompt).toContain("Available Platforms (International - Android Mobile)");
    expect(prompt).toContain("Amazon Shopping");
    expect(prompt).toContain("Fantuan Delivery");
    expect(prompt).toContain("Visit A City");
    expect(prompt).toContain("Nike Training Club (NTC)");
    expect(prompt).toContain(
      "Card click links must follow the system deep-link flow"
    );
  });

  it("keeps INTL non-android mobile on web catalog", () => {
    const prompt = buildSystemPrompt("INTL", "en", false, true, false);

    expect(prompt).toContain("Available Platforms (International - Web)");
    expect(prompt).not.toContain("Available Platforms (International - Android Mobile)");
  });
});

