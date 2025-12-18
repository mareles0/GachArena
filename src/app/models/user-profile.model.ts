export interface UserProfile {
  displayName?: string;
  profileIcon?: string; // caminho relativo como 'assets/avatares/avatar1.png'
  profileBackground?: string; // caminho relativo como 'assets/backgrounds/..'
  description?: string;
  showcasedCards?: string[]; // array de item IDs
}
