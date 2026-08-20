export type ToolkitAuthUser = {
  sub: string;
  clientId: string;
  roles: string[];
  scope?: string;
  username?: string;
  subType?: string;
};

/** @deprecated Prefer ToolkitAuthUser */
export type ToolkitAuthenticatedUser = ToolkitAuthUser;

export const TOOLKIT_REQUEST_USER = 'toolkitUser';
