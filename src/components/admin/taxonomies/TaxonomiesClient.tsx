"use client";

import { FolderOpen, FolderTree, Globe2, Tags, Users } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CategoriesTab } from "./CategoriesTab";
import { TagsTab } from "./TagsTab";
import { DossiersTab } from "./DossiersTab";
import { EntitiesTab, GeoZonesTab } from "./GeoEntitiesTabs";

/**
 * Écran Taxonomies (§11.2 /admin/taxonomies) — cinq onglets :
 * rubriques (arbre réordonnable), mots-clés (fusion réversible),
 * dossiers, zones géographiques et entités.
 */
export function TaxonomiesClient() {
  return (
    <div className="mx-auto w-full max-w-6xl">
      <header className="mb-6">
        <p className="kicker text-brand-red">Back-office · Éditorial</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
          Taxonomies
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-soft">
          Arborescence des rubriques, mots-clés, dossiers, zones géographiques
          et entités utilisés par la rédaction pour classer l&apos;information.
        </p>
      </header>

      <Tabs defaultValue="categories" className="gap-6">
        <TabsList
          className="h-auto w-full justify-start gap-1 overflow-x-auto rounded-md border border-rule bg-paper-alt p-1"
          aria-label="Sections de l'écran taxonomies"
        >
          <TabsTrigger
            value="categories"
            className="rounded-sm px-3 py-1.5 text-sm data-[state=active]:bg-paper data-[state=active]:shadow-none"
          >
            <FolderTree className="size-4" aria-hidden="true" />
            Rubriques
          </TabsTrigger>
          <TabsTrigger
            value="tags"
            className="rounded-sm px-3 py-1.5 text-sm data-[state=active]:bg-paper data-[state=active]:shadow-none"
          >
            <Tags className="size-4" aria-hidden="true" />
            Mots-clés
          </TabsTrigger>
          <TabsTrigger
            value="dossiers"
            className="rounded-sm px-3 py-1.5 text-sm data-[state=active]:bg-paper data-[state=active]:shadow-none"
          >
            <FolderOpen className="size-4" aria-hidden="true" />
            Dossiers
          </TabsTrigger>
          <TabsTrigger
            value="geo"
            className="rounded-sm px-3 py-1.5 text-sm data-[state=active]:bg-paper data-[state=active]:shadow-none"
          >
            <Globe2 className="size-4" aria-hidden="true" />
            Zones géo
          </TabsTrigger>
          <TabsTrigger
            value="entities"
            className="rounded-sm px-3 py-1.5 text-sm data-[state=active]:bg-paper data-[state=active]:shadow-none"
          >
            <Users className="size-4" aria-hidden="true" />
            Entités
          </TabsTrigger>
        </TabsList>

        <TabsContent value="categories" className="mt-0">
          <CategoriesTab />
        </TabsContent>
        <TabsContent value="tags" className="mt-0">
          <TagsTab />
        </TabsContent>
        <TabsContent value="dossiers" className="mt-0">
          <DossiersTab />
        </TabsContent>
        <TabsContent value="geo" className="mt-0">
          <GeoZonesTab />
        </TabsContent>
        <TabsContent value="entities" className="mt-0">
          <EntitiesTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
