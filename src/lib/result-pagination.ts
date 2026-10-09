export const HOTEL_PAGE_SIZE = 10;

export function paginateHotels<T>(items: T[], requestedPage: number) {
  const pages = Math.max(1, Math.ceil(items.length / HOTEL_PAGE_SIZE));
  const page = Math.max(1, Math.min(pages, requestedPage));
  const start = (page - 1) * HOTEL_PAGE_SIZE;
  return { page, pages, items: items.slice(start, start + HOTEL_PAGE_SIZE), start: items.length ? start + 1 : 0, end: Math.min(start + HOTEL_PAGE_SIZE, items.length) };
}