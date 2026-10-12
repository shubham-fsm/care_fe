import { faker } from "@faker-js/faker";
import { expect, test } from "@playwright/test";
import { expectToast } from "tests/helper/ui";
import { getApiHeaders, getApiUrl } from "tests/helper/utils";
import { getFacilityId } from "tests/support/facilityId";
import { getPatientId } from "tests/support/patientId";

test.use({ storageState: "tests/.auth/user.json" });

async function api<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${getApiUrl()}${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: getApiHeaders(),
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`${path} failed: ${res.status} ${await res.text()}`);
  }
  return (await res.json().catch(() => ({}))) as T;
}

interface Paginated<T> {
  results: T[];
}

test.describe("Serve next & open encounter", () => {
  let facilityId: string;
  let patientId: string;
  let practitionerId: string;
  let queueId: string;
  let servicePointName: string;
  let tokenId: string;

  test.beforeAll(async () => {
    facilityId = getFacilityId();
    patientId = getPatientId();

    const users = await api<Paginated<{ id: string }>>(
      `/api/v1/facility/${facilityId}/users/?limit=1`,
    );
    practitionerId = users.results[0].id;

    // A preferred encounter department makes the button a single click.
    const departments = await api<Paginated<{ id: string }>>(
      `/api/v1/facility/${facilityId}/organizations/?limit=1`,
    );
    await api(
      `/api/v1/facility/${facilityId}/organizations/${departments.results[0].id}/add_favorite/`,
      { favorite_list: "encounter_departments" },
    );

    const resource = {
      resource_type: "practitioner",
      resource_id: practitionerId,
    };
    const queue = await api<{ id: string }>(
      `/api/v1/facility/${facilityId}/token/queue/`,
      {
        ...resource,
        name: `Queue ${faker.string.alphanumeric(6)}`,
        date: new Date().toISOString().slice(0, 10),
      },
    );
    queueId = queue.id;

    servicePointName = `Room ${faker.string.alphanumeric(5)}`;
    await api(`/api/v1/facility/${facilityId}/token/sub_queue/`, {
      ...resource,
      name: servicePointName,
      status: "active",
    });

    const category = await api<{ id: string }>(
      `/api/v1/facility/${facilityId}/token/category/`,
      {
        resource_type: "practitioner",
        name: `Category ${faker.string.alphanumeric(6)}`,
        shorthand: faker.string.alpha({ length: 3, casing: "upper" }),
      },
    );

    const token = await api<{ id: string }>(
      `/api/v1/facility/${facilityId}/token/queue/${queueId}/token/`,
      { patient: patientId, category: category.id },
    );
    tokenId = token.id;
  });

  test("serves the next patient and opens their encounter in one click", async ({
    page,
  }) => {
    await page.goto(
      `/facility/${facilityId}/practitioner/${practitionerId}/queues/${queueId}/ongoing`,
    );

    const servicePoint = page
      .locator("div.bg-gray-200")
      .filter({ hasText: servicePointName });
    await servicePoint
      .getByRole("button", { name: /serve next & open encounter/i })
      .last()
      .click();

    await expectToast(page, /called\. (encounter started|opening encounter)/i);
    await expect(page).toHaveURL(
      new RegExp(`/patient/${patientId}/encounter/[0-9a-f-]+/updates`),
    );

    // The token is now being served at the service point.
    const token = await api<{ status: string; sub_queue?: { name: string } }>(
      `/api/v1/facility/${facilityId}/token/queue/${queueId}/token/${tokenId}/`,
    );
    expect(token.status).toBe("IN_PROGRESS");
    expect(token.sub_queue?.name).toBe(servicePointName);
  });
});
