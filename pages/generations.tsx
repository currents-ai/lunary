import DataTable from "@/components/Blocks/DataTable"

import {
  useCurrentApp,
  useGenerations,
  useModelNames,
  useTags,
  useTeam,
} from "@/utils/supabaseHooks"
import {
  Button,
  Drawer,
  Group,
  Input,
  MultiSelect,
  Stack,
  Text,
  Title,
} from "@mantine/core"

import SmartViewer from "@/components/Blocks/SmartViewer"
import {
  costColumn,
  durationColumn,
  feedbackColumn,
  inputColumn,
  nameColumn,
  outputColumn,
  tagsColumn,
  timeColumn,
  userColumn,
} from "@/utils/datatable"
import { IconBrandOpenai, IconDownload, IconSearch } from "@tabler/icons-react"
import { NextSeo } from "next-seo"
import { useContext, useState } from "react"

import TokensBadge from "@/components/Blocks/TokensBadge"
import { formatDateTime } from "@/utils/format"
import { useDebouncedState } from "@mantine/hooks"
import Empty from "../components/Layout/Empty"
import { AppContext } from "../utils/context"
import { modals } from "@mantine/modals"

const columns = [
  timeColumn("created_at"),
  nameColumn("Model"),
  durationColumn(),
  userColumn(),
  {
    header: "Tokens",
    size: 25,
    id: "tokens",
    sortingFn: (a, b) =>
      a.original.completion_tokens +
      a.original.prompt_tokens -
      (b.original.completion_tokens + b.original.prompt_tokens),
    cell: (props) => props.getValue(),
    accessorFn: (row) => row.prompt_tokens + row.completion_tokens,
  },
  costColumn(),
  feedbackColumn(),
  tagsColumn(),
  inputColumn("Prompt"),
  outputColumn("Result"),
]

function buildExportUrl(
  appId: string,
  query: string | null,
  models: string[],
  tags: string[]
) {
  const url = new URL("/api/generation/export", window.location.origin)

  url.searchParams.append("appId", appId)

  if (query) {
    url.searchParams.append("search", query)
  }

  if (models.length > 0) {
    url.searchParams.append("models", models.join(","))
  }

  if (tags.length > 0) {
    url.searchParams.append("tags", tags.join(","))
  }

  return url.toString()
}

function ExportButton({ url }: { url: string }) {
  const { team } = useTeam()

  if (team.plan === "pro") {
    return (
      <Button leftIcon={<IconDownload />} component="a" href={url}>
        Export to CSV
      </Button>
    )
  }

  return (
    <Button
      leftIcon={<IconDownload />}
      onClick={() =>
        modals.openContextModal({
          modal: "upgrade",
          size: 800,
          innerProps: {},
        })
      }
    >
      Export to CSV
    </Button>
  )
}

export default function Generations() {
  let { modelNames } = useModelNames()
  const [query, setQuery] = useDebouncedState(null, 1000)
  const [selectedModels, setSelectedModels] = useState([])
  const [selectedTags, setSelectedTags] = useState([])

  const { appId } = useContext(AppContext)
  const { app } = useCurrentApp()

  const { runs, loading, validating, loadMore } = useGenerations(
    query,
    selectedModels,
    selectedTags
  )
  const { tags } = useTags()
  const { team } = useTeam()

  const [selected, setSelected] = useState(null)

  const exportUrl = buildExportUrl(appId, query, selectedModels, selectedTags)

  if (!loading && !app?.activated) {
    return <Empty Icon={IconBrandOpenai} what="requests" />
  }

  return (
    <Stack h={"calc(100vh - var(--navbar-size))"}>
      <NextSeo title="Requests" />
      <Group position="apart">
        <Title>Generations</Title>
        <ExportButton url={exportUrl} />
      </Group>

      <Group position="right">
        <MultiSelect
          placeholder="Model"
          data={modelNames || []}
          clearable
          onChange={setSelectedModels}
        />
        <MultiSelect
          placeholder="Tags"
          data={tags || []}
          clearable
          onChange={setSelectedTags}
        />
        <Input
          icon={<IconSearch size={16} />}
          w={300}
          placeholder="Type to filter"
          defaultValue={query}
          onChange={(event) => setQuery(event.currentTarget.value)}
        />
      </Group>

      <Drawer
        opened={!!selected}
        size="lg"
        keepMounted
        position="right"
        title={selected ? formatDateTime(selected.created_at) : ""}
        onClose={() => setSelected(null)}
      >
        {selected && (
          <Stack>
            <Text size="sm">Model: {selected.name}</Text>
            {typeof selected.params?.temperature !== "undefined" && (
              <Text size="sm">Temperature: {selected.params?.temperature}</Text>
            )}

            <Group position="apart">
              <Text weight="bold" size="sm">
                Input
              </Text>
              <TokensBadge tokens={selected.prompt_tokens} />
            </Group>
            <SmartViewer data={selected.input} />
            <Group position="apart">
              <Text weight="bold" size="sm">
                {selected.error ? "Error" : "Output"}
              </Text>
              <TokensBadge tokens={selected.completion_tokens} />
            </Group>
            <SmartViewer data={selected.output} error={selected.error} />
          </Stack>
        )}
      </Drawer>

      <DataTable
        onRowClicked={(row) => {
          setSelected(row)
        }}
        loading={loading || validating}
        loadMore={loadMore}
        columns={columns}
        data={runs}
      />
    </Stack>
  )
}
