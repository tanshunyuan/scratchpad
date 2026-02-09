export type Image = {
  alt_description: string;
  urls: {
    regular: string;
    raw: string;
  };
  user: {
    first_name: string;
    links: {
      html: string;
    };
  };
};

export type BirdResponse = {
  bird: boolean;
  species: string;
  location: string;
};

export type ImageQuery = "wildlife" | "feathers" | "flying" | "birds";

export type ApiResult<T> = {
  ok: true;
  data: T;
} | {
  ok: false;
  error: string;
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

export const getImage = async ({
  query,
}: {
  query: ImageQuery;
}): Promise<ApiResult<Image>> => {
  try {
    const response = await fetch(
      `${API_BASE_URL}/api/get-unsplash-image?query=${query}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      },
    );

    if (!response.ok) {
      const error = await response.json();
      return { ok: false, error: error.msg || "Failed to fetch image" };
    }

    const data = await response.json();
    return { ok: true, data };
  } catch (error) {
    console.error("Error fetching image:", error);
    return { ok: false, error: "Failed to fetch image" };
  }
};

export const promptOpenai = async ({
  imageUrl,
}: {
  imageUrl: string;
}): Promise<ApiResult<BirdResponse>> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/image-metadata`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ imageUrl }),
    });

    if (!response.ok) {
      const error = await response.json();
      return { ok: false, error: error.msg || "Failed to fetch image metadata" };
    }

    const data = await response.json();
    return { ok: true, data };
  } catch (error) {
    console.error("Error fetching image metadata:", error);
    return { ok: false, error: "Failed to fetch image metadata" };
  }
};
