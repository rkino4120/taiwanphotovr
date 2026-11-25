export interface Photo {
  url: string;
  width?: number;
  height?: number;
}

export interface Work {
  id: string;
  title: string;
  body?: string;
  shootingdate?: string;
  photo?: Photo;
  createdAt?: string;
  publishedAt?: string;
  updatedAt?: string;
  revisedAt?: string;
  [key: string]: unknown;
}
