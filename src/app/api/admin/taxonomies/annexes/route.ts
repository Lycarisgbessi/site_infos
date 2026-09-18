import type { NextRequest } from "next/server";
import { dossierSaveSchema, geoZoneCreateSchema, entitySaveSchema } from "@/schemas/taxonomy";
import { requireApiSession, apiOk, toErrorResponse, ValidationError } from "@/lib/api/respond";
import {
  listDossiers,
  saveDossier,
  listGeoZones,
  createGeoZone,
  listEntities,
  createEntity,
  updateGeoZone,
  updateEntity,
} from "@/server/services/taxonomies";
import { z } from "zod";

export const runtime = "nodejs";

const geoPatchSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(120),
  type: z.enum(["continent", "region", "country", "city"]),
});
const entityPatchSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(300),
  description: z.string().max(3000).nullable().optional(),
});

/**
 * /api/admin/taxonomies/annexes — dossiers, zones géo, entités
 * GET  ?kind=dossiers|geo|entities
 * POST {kind:"dossier"|"geo"|"entity", …}
 * PATCH {kind:"geo"|"entity", id, …}
 */
export async function GET(request: NextRequest) {
  try {
    await requireApiSession();
    const kind = new URL(request.url).searchParams.get("kind");
    if (kind === "dossiers") return apiOk(await listDossiers());
    if (kind === "geo") return apiOk(await listGeoZones());
    if (kind === "entities") return apiOk(await listEntities());
    throw new ValidationError("Paramètre kind invalide (dossiers|geo|entities).");
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireApiSession();
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) throw new ValidationError("Corps de requête manquant.");
    const kind = body.kind;
    if (kind === "dossier") {
      const { kind: _k, ...rest } = body as { kind?: string } & Record<string, unknown>;
      void _k;
      const input = dossierSaveSchema.parse(rest);
      return apiOk(await saveDossier(input, session.user.id));
    }
    if (kind === "geo") {
      const input = geoZoneCreateSchema.parse(body);
      return apiOk(await createGeoZone(input, session.user.id));
    }
    if (kind === "entity") {
      const input = entitySaveSchema.parse(body);
      return apiOk(await createEntity(input, session.user.id));
    }
    throw new ValidationError("Paramètre kind invalide.");
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await requireApiSession();
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) throw new ValidationError("Corps de requête manquant.");
    if (body.kind === "geo") {
      const input = geoPatchSchema.parse(body);
      return apiOk(await updateGeoZone(input.id, { name: input.name, type: input.type }, session.user.id));
    }
    if (body.kind === "entity") {
      const input = entityPatchSchema.parse(body);
      return apiOk(
        await updateEntity(input.id, { name: input.name, description: input.description ?? null }, session.user.id)
      );
    }
    throw new ValidationError("Paramètre kind invalide.");
  } catch (error) {
    return toErrorResponse(error);
  }
}
