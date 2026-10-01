// Add characters here and place their images in public/. Keep IDs stable.
export const avatarSkins = [
  { id: "initial", name: "Player initial", image: null },
  { id: "snape", name: "Snape", image: "/snape1.jpg" },
] as const;

export function resolveAvatarSkin(id: string | null) {
  return avatarSkins.find((skin) => skin.id === id) ?? avatarSkins[0];
}
