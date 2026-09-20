/**
 * Centralized Firestore path helpers. Use the Admin SDK on the server;
 * client components should go through the protected API routes instead
 * of touching Firestore directly (rules below still enforce ownership).
 */
export const firestorePaths = {
  user: (userId: string) => `users/${userId}`,
  conversations: (userId: string) => `users/${userId}/conversations`,
  conversation: (userId: string, conversationId: string) =>
    `users/${userId}/conversations/${conversationId}`,
  messages: (userId: string, conversationId: string) =>
    `users/${userId}/conversations/${conversationId}/messages`,
  message: (userId: string, conversationId: string, messageId: string) =>
    `users/${userId}/conversations/${conversationId}/messages/${messageId}`,
  savedItems: (userId: string) => `users/${userId}/saved-items`,
  savedItem: (userId: string, savedItemId: string) => `users/${userId}/saved-items/${savedItemId}`,
  preferences: (userId: string) => `users/${userId}/preferences/main`,
} as const;
