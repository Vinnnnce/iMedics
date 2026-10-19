import { ApiError } from "./errors";

export function getStorageEndpoint(value = process.env.S3_ENDPOINT): string | undefined {
  const configuredEndpoint = value?.trim();
  if (!configuredEndpoint) return undefined;

  try {
    const endpoint = new URL(configuredEndpoint);
    if (
      (endpoint.protocol !== "https:" && endpoint.protocol !== "http:") ||
      !endpoint.hostname ||
      endpoint.username ||
      endpoint.password
    ) {
      throw new Error("Unsupported S3 endpoint URL");
    }
  } catch {
    throw new ApiError(
      503,
      "File storage endpoint is invalid. Set S3_ENDPOINT to a valid S3 service URL without placeholder text.",
    );
  }

  return configuredEndpoint;
}

export function getStorageRegion(
  region = process.env.S3_REGION,
  endpoint = getStorageEndpoint(),
): string {
  const configuredRegion = region?.trim();
  if (!configuredRegion) {
    if (endpoint) return "auto";
    throw new ApiError(503, "Set S3_REGION to the AWS region containing S3_BUCKET.");
  }
  if (configuredRegion.toLowerCase() === "auto" && !endpoint) {
    throw new ApiError(503, "S3_REGION cannot be auto when using AWS S3. Set it to the bucket's AWS region.");
  }
  return configuredRegion;
}
