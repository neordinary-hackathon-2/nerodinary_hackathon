/**
 * DB 테이블(Drizzle)과 공용 엔티티(zod, 레포 루트 shared/entities)는 따로 정의한다.
 * 둘이 어긋나면 컴파일 오류가 나도록 테이블 파일에서 아래처럼 대조한다.
 *
 *   // src/database/schema/content.schema.ts
 *   export const contents = mysqlTable('contents', { ... });
 *   type _Check = AssertNoMismatch<EntityMismatch<typeof contents.$inferSelect, Content>>;
 *
 * 어긋난 필드가 있으면 오류 메시지에 그 필드 이름이 나온다.
 *   Type '"memo"' does not satisfy the constraint 'never'.
 *
 * - 엔티티의 모든 필드가 테이블에 있어야 하고 타입(null 허용 여부 포함)이 같아야 한다.
 * - 테이블에만 있는 컬럼(비밀번호 해시처럼 밖으로 내보내지 않는 값)은 허용한다.
 * - Date 컬럼은 JSON 응답에서 문자열이 되므로 엔티티에서는 string 으로 정의한다.
 */
type Jsonified<T> = T extends Date ? string : T;

/** 엔티티 필드 중 테이블에 없거나 타입이 다른 필드 이름의 유니온. 모두 맞으면 never. */
export type EntityMismatch<Row, Entity> = {
  [K in keyof Entity]: K extends keyof Row
    ? [Entity[K]] extends [Jsonified<Row[K]>]
      ? [Jsonified<Row[K]>] extends [Entity[K]]
        ? never
        : K
      : K
    : K;
}[keyof Entity];

export type AssertNoMismatch<T extends never> = T;
