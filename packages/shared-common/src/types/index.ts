export interface BaseEntity {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

export type Nullable<T> = T | null;

export type Optional<T> = T | undefined;
