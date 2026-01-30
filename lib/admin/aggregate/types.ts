export type AdminDataSource = "CN" | "INTL";
export type AdminSourceFilter = AdminDataSource | "ALL";

export type AdminListParams = {
  source: AdminSourceFilter;
  limit: number;
  offset: number;
};

export type AdminDataError = {
  source: AdminDataSource;
  message: string;
};

