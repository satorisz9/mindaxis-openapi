/**
 * MindAxis Open API - API Key Usage Example
 *
 * This example demonstrates how to use the API Key authentication
 * to fetch public personality profiles.
 *
 * Run: npx ts-node api-key-usage.ts
 */

import { MindAxisClient } from '../sdk/mindaxis-client';

// Configuration
const client = new MindAxisClient({
  apiKey: process.env.MINDAXIS_API_KEY || 'your-api-key',
});

// ===========================================
// Example 1: Fetch a single profile
// ===========================================

async function fetchSingleProfile(twinShareId: string) {
  console.log('\n=== Fetching Single Profile ===');

  try {
    const profile = await client.getPublicProfile(twinShareId);

    console.log('Profile found:');
    console.log(`  Name: ${profile.displayName || 'Anonymous'}`);
    console.log(`  Twin: ${profile.twinName || 'Unnamed'}`);
    console.log(`  MBTI: ${profile.personalitySnapshot.mbti}`);
    console.log(`  Full Code: ${profile.personalitySnapshot.fullCode}`);
    console.log('\n  Big Five Scores:');
    console.log(`    Openness:          ${profile.personalitySnapshot.bigFive.O}`);
    console.log(`    Conscientiousness: ${profile.personalitySnapshot.bigFive.C}`);
    console.log(`    Extraversion:      ${profile.personalitySnapshot.bigFive.E}`);
    console.log(`    Agreeableness:     ${profile.personalitySnapshot.bigFive.A}`);
    console.log(`    Neuroticism:       ${profile.personalitySnapshot.bigFive.N}`);
    console.log(`\n  Strengths: ${profile.personalitySnapshot.strengthsSummary}`);
    console.log(`  Weaknesses: ${profile.personalitySnapshot.weaknessesSummary}`);

    return profile;
  } catch (error) {
    console.error('Error fetching profile:', error);
    throw error;
  }
}

// ===========================================
// Example 2: Fetch multiple profiles
// ===========================================

async function fetchMultipleProfiles(twinShareIds: string[]) {
  console.log('\n=== Fetching Multiple Profiles ===');

  try {
    const result = await client.getPublicProfiles(twinShareIds);

    console.log(`Requested: ${result.meta.requested}`);
    console.log(`Found: ${result.meta.found}`);
    console.log(`Not Found: ${result.notFound.length}`);

    if (result.notFound.length > 0) {
      console.log(`  Missing IDs: ${result.notFound.join(', ')}`);
    }

    console.log('\nProfiles:');
    for (const [id, profile] of Object.entries(result.profiles)) {
      console.log(`  ${id}: ${profile.personalitySnapshot.mbti} - ${profile.displayName || 'Anonymous'}`);
    }

    return result;
  } catch (error) {
    console.error('Error fetching profiles:', error);
    throw error;
  }
}

// ===========================================
// Example 3: Calculate Big Five compatibility
// ===========================================

function calculateBigFiveCompatibility(
  profile1: { bigFive: { O: number; C: number; E: number; A: number; N: number } },
  profile2: { bigFive: { O: number; C: number; E: number; A: number; N: number } }
): number {
  const bf1 = profile1.bigFive;
  const bf2 = profile2.bigFive;

  // Simple Euclidean distance-based compatibility (0-100)
  // Lower distance = higher compatibility
  const distance = Math.sqrt(
    Math.pow(bf1.O - bf2.O, 2) +
    Math.pow(bf1.C - bf2.C, 2) +
    Math.pow(bf1.E - bf2.E, 2) +
    Math.pow(bf1.A - bf2.A, 2) +
    Math.pow(bf1.N - bf2.N, 2)
  );

  // Max possible distance is ~223.6 (100 difference on all 5 traits)
  // Convert to 0-100 scale where 100 is perfect match
  const maxDistance = Math.sqrt(5 * 100 * 100);
  const compatibility = Math.round((1 - distance / maxDistance) * 100);

  return compatibility;
}

async function compareProfiles(id1: string, id2: string) {
  console.log('\n=== Comparing Two Profiles ===');

  try {
    const result = await client.getPublicProfiles([id1, id2]);

    const profile1 = result.profiles[id1];
    const profile2 = result.profiles[id2];

    if (!profile1 || !profile2) {
      console.log('One or both profiles not found');
      return;
    }

    console.log(`Profile 1: ${profile1.displayName || id1}`);
    console.log(`  MBTI: ${profile1.personalitySnapshot.mbti}`);
    console.log(`  Big Five: O=${profile1.personalitySnapshot.bigFive.O}, C=${profile1.personalitySnapshot.bigFive.C}, E=${profile1.personalitySnapshot.bigFive.E}, A=${profile1.personalitySnapshot.bigFive.A}, N=${profile1.personalitySnapshot.bigFive.N}`);

    console.log(`\nProfile 2: ${profile2.displayName || id2}`);
    console.log(`  MBTI: ${profile2.personalitySnapshot.mbti}`);
    console.log(`  Big Five: O=${profile2.personalitySnapshot.bigFive.O}, C=${profile2.personalitySnapshot.bigFive.C}, E=${profile2.personalitySnapshot.bigFive.E}, A=${profile2.personalitySnapshot.bigFive.A}, N=${profile2.personalitySnapshot.bigFive.N}`);

    const compatibility = calculateBigFiveCompatibility(
      profile1.personalitySnapshot,
      profile2.personalitySnapshot
    );

    console.log(`\nCompatibility Score: ${compatibility}%`);

    return { profile1, profile2, compatibility };
  } catch (error) {
    console.error('Error comparing profiles:', error);
    throw error;
  }
}

// ===========================================
// Example 4: Group profiles by MBTI type
// ===========================================

async function groupByMBTI(twinShareIds: string[]) {
  console.log('\n=== Grouping Profiles by MBTI ===');

  try {
    const result = await client.getPublicProfiles(twinShareIds);

    const groups: Record<string, typeof result.profiles[string][]> = {};

    for (const profile of Object.values(result.profiles)) {
      const mbti = profile.personalitySnapshot.mbti;
      if (!groups[mbti]) {
        groups[mbti] = [];
      }
      groups[mbti].push(profile);
    }

    console.log('MBTI Distribution:');
    for (const [mbti, profiles] of Object.entries(groups).sort()) {
      console.log(`  ${mbti}: ${profiles.length} users`);
      for (const p of profiles) {
        console.log(`    - ${p.displayName || p.id}`);
      }
    }

    return groups;
  } catch (error) {
    console.error('Error grouping profiles:', error);
    throw error;
  }
}

// ===========================================
// Main
// ===========================================

async function main() {
  console.log('MindAxis API Key Usage Examples');
  console.log('================================');

  // Replace with actual twinShareIds
  const sampleIds = [
    'sample-twin-id-1',
    'sample-twin-id-2',
    'sample-twin-id-3',
  ];

  // Example 1: Single profile
  await fetchSingleProfile(sampleIds[0]).catch(() => {});

  // Example 2: Multiple profiles
  await fetchMultipleProfiles(sampleIds).catch(() => {});

  // Example 3: Compare two profiles
  await compareProfiles(sampleIds[0], sampleIds[1]).catch(() => {});

  // Example 4: Group by MBTI
  await groupByMBTI(sampleIds).catch(() => {});

  console.log('\n=== Done ===');
}

// Run if executed directly
main().catch(console.error);
