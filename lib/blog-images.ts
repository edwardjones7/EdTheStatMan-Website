// Default cover photos per blog tag (free-license: Unsplash license / CC0 rawpixel).
// A post's own cover_image always wins; these fill in when none is set.
export const TAG_IMAGE: Record<string, string> = {
  'NFL': '/images/sports/nfl.jpg',
  'NBA': '/images/sports/nba.jpg',
  'College Football': '/images/sports/cfb.jpg',
  'College Basketball': '/images/sports/cbb.jpg',
  'Education': '/images/sports/education.jpg',
  'Strategy': '/images/sports/strategy.jpg',
  'General': '/images/sports/general.jpg',
}

export function coverForPost(coverImage: string | null | undefined, tag: string): string {
  return coverImage || TAG_IMAGE[tag] || TAG_IMAGE['General']
}
