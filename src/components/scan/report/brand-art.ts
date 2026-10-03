import aiSpotlight from "@/assets/home/ai-spotlight.jpg";
import audienceBusiness from "@/assets/home/audience-business.jpg";
import heroBg from "@/assets/home/hero-bg.jpg";
import serviceAi from "@/assets/home/service-ai.jpg";
import serviceWebsites from "@/assets/home/service-websites.jpg";
import { SWIRL_VIDEO } from "@/components/landing/media";

/** A crop of one of the studio's own artworks (never stock data imagery). */
export type BrandArt = { src: string; position: string };

/** The Vortex swirl, used when a company has no screenshot or OG image. */
export const SWIRL_ART: BrandArt = { src: SWIRL_VIDEO.poster, position: "50% 45%" };

/** Rotating tiles for roadmap phases, chosen to read as build → automate → assist → grow. */
export const PHASE_ART: BrandArt[] = [
  { src: serviceWebsites, position: "50% 55%" },
  { src: aiSpotlight, position: "35% 40%" },
  { src: serviceAi, position: "55% 50%" },
  { src: heroBg, position: "62% 45%" },
  { src: audienceBusiness, position: "50% 60%" },
  { src: SWIRL_VIDEO.poster, position: "30% 30%" },
];
