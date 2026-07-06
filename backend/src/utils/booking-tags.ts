import { Pool, PoolClient } from 'pg';

export interface BookingTagRow {
  id: string;
  name: string;
}

export const parseResourceTags = (value: unknown): BookingTagRow[] => parseBookingTags(value);

export const parseBookingTags = (value: unknown): BookingTagRow[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (!item || typeof item !== 'object') {
        return null;
      }

      const tag = item as { id?: unknown; name?: unknown };
      if (!tag.id || !tag.name) {
        return null;
      }

      return {
        id: String(tag.id),
        name: String(tag.name),
      };
    })
    .filter((item): item is BookingTagRow => item !== null);
};

export const RESOURCE_WITH_TAGS_SELECT = `
  SELECT
    r.*,
    COALESCE(
      json_agg(
        json_build_object('id', t.id, 'name', t.name)
        ORDER BY t.name
      ) FILTER (WHERE t.id IS NOT NULL),
      '[]'::json
    ) AS tags
  FROM booking_resources r
  LEFT JOIN booking_resource_tags rt ON rt.resource_id = r.id
  LEFT JOIN booking_tags t ON t.id = rt.tag_id
`;

export const syncResourceTags = async (
  client: Pool | PoolClient,
  resourceId: string | number,
  tagIds: string[] | undefined
): Promise<void> => {
  await client.query('DELETE FROM booking_resource_tags WHERE resource_id = $1', [resourceId]);

  if (!tagIds?.length) {
    return;
  }

  const uniqueTagIds = [...new Set(tagIds.map((id) => String(id).trim()).filter(Boolean))];

  for (const tagId of uniqueTagIds) {
    await client.query(
      `INSERT INTO booking_resource_tags (resource_id, tag_id)
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [resourceId, tagId]
    );
  }
};

export const syncBookingTags = async (
  client: Pool | PoolClient,
  bookingId: string | number,
  tagIds: string[] | undefined
): Promise<void> => {
  await client.query('DELETE FROM booking_item_tags WHERE booking_id = $1', [bookingId]);

  if (!tagIds?.length) {
    return;
  }

  const uniqueTagIds = [...new Set(tagIds.map((id) => String(id).trim()).filter(Boolean))];

  for (const tagId of uniqueTagIds) {
    await client.query(
      `INSERT INTO booking_item_tags (booking_id, tag_id)
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [bookingId, tagId]
    );
  }
};

export const BOOKING_TAGS_SUBQUERY = `
  COALESCE(
    (
      SELECT json_agg(
        json_build_object('id', t.id, 'name', t.name)
        ORDER BY t.name
      )
      FROM booking_item_tags bt
      JOIN booking_tags t ON t.id = bt.tag_id
      WHERE bt.booking_id = b.id
    ),
    '[]'::json
  ) AS tags
`;

export const normalizeTagIds = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return [...new Set(value.map((item) => String(item).trim()).filter(Boolean))];
};
