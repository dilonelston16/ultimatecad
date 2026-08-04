export type ConsolePlatform = "ps4" | "ps5" | "xbox_one" | "xbox_series";
export type MembershipStatus = "pending" | "active" | "suspended" | "removed";
export interface OrganizationNode { id: string; community_id: string; parent_id: string | null; type: "agency" | "department" | "division" | "subdivision"; name: string; slug: string; }
