"use client";

import {
  Document,
  Font,
  Link,
  Page,
  StyleSheet,
  Text,
  View,
  pdf,
} from "@react-pdf/renderer";
import {
  buildShowSections,
  formatDate,
  formatWeekdayShort,
  safeFileName,
  showVenue,
  fullWidthSections,
  isLongText,
  oneLine,
  splitInTwo,
  splitColumns,
  showHeading,
  showTitle,
} from "./bookingFormat";

// Tour/show PDF. Layout:
//   project PDF: S.1 cover, S.2 Inhaltsverzeichnis, then one show per page
//   show PDF:    just that show's page(s)
// Each show starts on a new page and may flow onto more pages.

// Never split words with hyphens.
Font.registerHyphenationCallback((word) => [word]);

const INK = "#1a1a1a";
const RULE_GREY = "#6b6b6b"; // only the TOC dot leaders
// Narrow enough for two columns on A4 (each ~225pt wide).
const LABEL_WIDTH = 76;
const TIME_WIDTH = 46;

// Cover, Inhaltsverzeichnis and footer: always at full size.
const s = StyleSheet.create({
  page: {
    paddingTop: 56,
    paddingBottom: 64,
    paddingHorizontal: 56,
    fontFamily: "Helvetica",
    fontSize: 11,
    lineHeight: 1.5,
    color: INK,
  },
  cover: {
    flex: 1,
    justifyContent: "center",
    paddingBottom: 80,
  },
  coverWorkspace: { fontSize: 16, marginBottom: 8 },
  coverTitle: {
    fontSize: 40,
    fontFamily: "Helvetica-Bold",
    lineHeight: 1.1,
  },
  coverDates: { fontSize: 12, marginTop: 16 },
  tocTitle: {
    fontSize: 22,
    fontFamily: "Helvetica-Bold",
    marginBottom: 24,
  },
  tocRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginBottom: 10,
    textDecoration: "none",
    color: INK,
  },
  tocDate: { width: 100 },
  tocLeader: {
    flex: 1,
    borderBottomWidth: 0.75,
    borderBottomStyle: "dotted",
    borderBottomColor: RULE_GREY,
    marginHorizontal: 6,
    marginBottom: 3,
  },
  tocPage: { width: 24, textAlign: "right" },
  footer: {
    // Anchored from the top: with `bottom`, react-pdf drops the footer on
    // shows whose content flows onto a second page. 798 = A4 (842pt) − 44.
    position: "absolute",
    top: 798,
    left: 56,
    right: 56,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 8,
  },
});

// A gig page's styles at a given scale (1 = full size). Font sizes and
// vertical spacing shrink together so a long gig still fits on one page;
// page margins and the footer stay fixed.
const gigStylesCache = new Map();
function gigStyles(k) {
  if (gigStylesCache.has(k)) return gigStylesCache.get(k);
  const n = (v) => Math.round(v * k * 100) / 100;
  const st = StyleSheet.create({
    page: { ...s.page, fontSize: n(11) },
    showTitle: {
      fontSize: n(20),
      fontFamily: "Helvetica-Bold",
      lineHeight: 1.25,
    },
    showSub: { fontSize: n(12), marginTop: n(4) },
    section: { marginTop: n(24) },
    rule: {
      width: "100%",
      borderBottomWidth: 1,
      borderBottomColor: "#000000",
      marginTop: n(12),
      marginBottom: n(24),
    },
    sectionTitle: {
      fontSize: n(11),
      fontFamily: "Helvetica-Bold",
      marginBottom: n(8),
    },
    venue: { marginBottom: n(16) },
    // "Setlänge  45–60 min" on one line.
    inline: { flexDirection: "row", alignItems: "baseline" },
    inlineTitle: { marginBottom: 0, marginRight: n(10) },
    columns: { flexDirection: "row", marginTop: n(28) },
    column: { flex: 1, minWidth: 0 },
    columnLeft: { marginRight: 32 },
    textColumns: { flexDirection: "row" },
    sectionFirst: { marginTop: 0 },
    scheduleRow: { flexDirection: "row", marginBottom: n(10) },
    row: { flexDirection: "row", marginBottom: n(6) },
    label: { width: n(LABEL_WIDTH) },
    time: { width: n(TIME_WIDTH), fontFamily: "Helvetica-Bold" },
    value: { flex: 1 },
    gap: { height: n(7) },
    link: { color: INK, textDecoration: "underline" },
  });
  gigStylesCache.set(k, st);
  return st;
}

function Footer({ left }) {
  return (
    <View style={s.footer} fixed>
      <Text>{left}</Text>
      <Text
        render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
      />
    </View>
  );
}

// The section body as a flat list of unbreakable blocks (one per row/line),
// so a page break can only fall between them.
function sectionBlocks(section, s) {
  if (section.type === "schedule") {
    return section.rows.map((row, i) => (
      <View key={i} style={s.scheduleRow}>
        <Text style={s.time}>{row.time || ""}</Text>
        <Text style={s.value}>{row.text}</Text>
      </View>
    ));
  }
  if (section.type === "text") {
    // Blank lines in the source become paragraph gaps.
    const renderLines = (lines) =>
      lines.map((line, i) =>
        line.trim() ? (
          <Text key={i}>{line}</Text>
        ) : (
          <View key={i} style={s.gap} />
        ),
      );
    // Long text (> LONG_TEXT_LINES): two columns, split near the middle.
    if (isLongText(section.text)) {
      const [left, right] = splitInTwo(section.text);
      return [
        <View key="cols" style={s.textColumns}>
          <View style={[s.column, s.columnLeft]}>{renderLines(left)}</View>
          <View style={s.column}>{renderLines(right)}</View>
        </View>,
      ];
    }
    return renderLines(section.text.split("\n"));
  }
  return section.rows.map((row) => (
    <View key={row.label} style={s.row}>
      <Text style={s.label}>{row.label}</Text>
      <View style={s.value}>
        {row.lines.map((line, i) => (
          <Text key={i}>{line}</Text>
        ))}
        {row.links.map((link) => (
          <Link key={link.href} src={link.href} style={s.link}>
            {link.text}
          </Link>
        ))}
      </View>
    </View>
  ));
}

// `first`: the opening section of a column sits flush at the column top.
function Section({ section, withRule, first: isFirst = false, st: s }) {
  // Long two-column text is a single block and stays whole (with its
  // heading): split across pages its columns would read out of order.
  const [first, ...rest] = sectionBlocks(section, s);
  const style = isFirst ? [s.section, s.sectionFirst] : s.section;
  return (
    <View style={style}>
      {/* Rule + title travel with the first block, so a heading never sits
          alone at the bottom of a page. */}
      <View wrap={false}>
        {withRule && <View style={s.rule} />}
        <Text style={s.sectionTitle}>{section.title}</Text>
        {first}
      </View>
      {rest.map((block) => (
        <View key={block.key} wrap={false}>
          {block}
        </View>
      ))}
    </View>
  );
}

function ShowPage({ show, venue, footer, onPage, onSpan, scale = 1 }) {
  const s = gigStyles(scale);
  const sections = buildShowSections(show, venue);
  const venueBlock = showVenue(venue);
  return (
    <Page size="A4" style={s.page}>
      {/* Records every page this show covers, for the fit-to-one-page pass. */}
      <Text
        fixed
        render={({ pageNumber }) => {
          onSpan?.(show.id, pageNumber);
          return "";
        }}
      />
      {/* Records the page this show starts on, for the Inhaltsverzeichnis. */}
      <Text
        id={`show-${show.id}`}
        render={({ pageNumber }) => {
          onPage?.(show.id, pageNumber);
          return "";
        }}
      />
      <Text style={s.showTitle}>{showHeading(show, venue)}</Text>
      {show.event_name ? (
        <Text style={s.showSub}>{show.event_name}</Text>
      ) : null}
      {/* Two columns like the app sheet: left Adresse + Schedule, right the
          rest. Rules only between sections of the same column. */}
      <View style={s.columns}>
        {splitColumns(sections).map((column, c) => (
          <View key={c} style={c === 0 ? [s.column, s.columnLeft] : s.column}>
            {c === 0 && show.set_length ? (
              <View style={[s.venue, s.inline]}>
                <Text style={[s.sectionTitle, s.inlineTitle]}>Setlänge</Text>
                <Text style={s.value}>{oneLine(show.set_length)}</Text>
              </View>
            ) : null}
            {c === 0 && venueBlock ? (
              <View style={s.venue}>
                <Text style={s.sectionTitle}>Adresse</Text>
                {venueBlock.lines.map((line, i) => (
                  <Text key={i}>{line}</Text>
                ))}
              </View>
            ) : null}
            {column.map((section, i) => (
              <Section
                key={section.key}
                st={s}
                section={section}
                withRule={i > 0}
                first={i === 0 && !(c === 0 && (venueBlock || show.set_length))}
              />
            ))}
          </View>
        ))}
      </View>
      {/* Long free text (tech specs, notes) spans both columns at the end. */}
      {fullWidthSections(sections).map((section) => (
        <Section key={section.key} st={s} section={section} withRule />
      ))}
      <Footer left={footer} />
    </Page>
  );
}

export function TourDocument({
  workspaceName,
  project,
  shows,
  venueById,
  withCover,
  pages,
  onPage,
  onSpan,
  scales,
}) {
  const footer = [workspaceName, project.name].filter(Boolean).join(" · ");
  const first = shows[0]?.show_date;
  const last = shows[shows.length - 1]?.show_date;
  return (
    <Document title={`${footer}`} author={workspaceName}>
      {withCover && (
        <Page size="A4" style={s.page}>
          <View style={s.cover}>
            {workspaceName ? (
              <Text style={s.coverWorkspace}>{workspaceName}</Text>
            ) : null}
            <Text style={s.coverTitle}>{project.name}</Text>
            {first ? (
              <Text style={s.coverDates}>
                {first === last
                  ? formatDate(first)
                  : `${formatDate(first)} – ${formatDate(last)}`}
                {"  ·  "}
                {shows.length} {shows.length === 1 ? "Show" : "Shows"}
              </Text>
            ) : null}
          </View>
        </Page>
      )}
      {withCover && (
        <Page size="A4" style={s.page}>
          <Text style={s.tocTitle}>Inhalt</Text>
          {shows.map((show) => {
            const venue = venueById.get(show.venue_id);
            const place = [showTitle(show, venue), venue?.city]
              .filter(Boolean)
              .join(" · ");
            return (
              <Link key={show.id} src={`#show-${show.id}`} style={s.tocRow}>
                <Text style={s.tocDate}>
                  {formatWeekdayShort(show.show_date)}{" "}
                  {formatDate(show.show_date)}
                </Text>
                <Text>{place}</Text>
                <View style={s.tocLeader} />
                <Text style={s.tocPage}>{pages?.[show.id] ?? "00"}</Text>
              </Link>
            );
          })}
          <Footer left={footer} />
        </Page>
      )}
      {shows.map((show) => (
        <ShowPage
          key={show.id}
          show={show}
          venue={venueById.get(show.venue_id)}
          footer={footer}
          onPage={onPage}
          onSpan={onSpan}
          scale={scales?.[show.id] ?? 1}
        />
      ))}
    </Document>
  );
}

// Smallest scale a gig may shrink to; below that it may use a second page.
const MIN_SCALE = 0.55;
const SCALE_STEP = 0.92;

// Lays the gigs out and shrinks every gig that spills onto a second page,
// step by step, until it fits (or MIN_SCALE is reached). Returns
// { [showId]: scale }. `layout(element)` renders a document (toBlob in the
// browser, toBuffer in tests).
export async function fitScales(props, layout) {
  const scales = Object.fromEntries(props.shows.map((sh) => [sh.id, 1]));
  for (let round = 0; round < 12; round += 1) {
    const spans = {};
    const onSpan = (id, page) => {
      (spans[id] ||= new Set()).add(page);
    };
    await layout(
      <TourDocument
        {...props}
        withCover={false}
        scales={{ ...scales }}
        onSpan={onSpan}
      />,
    );
    let changed = false;
    for (const sh of props.shows) {
      if ((spans[sh.id]?.size ?? 1) > 1 && scales[sh.id] > MIN_SCALE) {
        scales[sh.id] = Math.max(
          MIN_SCALE,
          Math.round(scales[sh.id] * SCALE_STEP * 100) / 100,
        );
        changed = true;
      }
    }
    if (!changed) break;
  }
  return scales;
}

// Full pipeline: fit every gig to one page, then (with cover) lay out once
// more to learn where each gig starts and print that into the
// Inhaltsverzeichnis. The placeholder ("00") has the width of real numbers,
// so the layout doesn't shift between the passes.
export async function buildTourDocument(props, layout) {
  const scales = await fitScales(props, layout);
  if (!props.withCover) return <TourDocument {...props} scales={scales} />;
  const pages = {};
  const onPage = (id, page) => {
    if (pages[id] === undefined || page < pages[id]) pages[id] = page;
  };
  await layout(<TourDocument {...props} scales={scales} onPage={onPage} />);
  return <TourDocument {...props} scales={scales} pages={pages} />;
}

export async function downloadTourPdf({
  workspaceName,
  project,
  shows,
  venueById,
  withCover,
}) {
  const props = { workspaceName, project, shows, venueById, withCover };
  const layout = (element) => pdf(element).toBlob();
  const blob = await layout(await buildTourDocument(props, layout));

  const name = withCover
    ? `${workspaceName} - ${project.name}`
    : `${workspaceName} - ${formatDate(shows[0].show_date)} ${showTitle(
        shows[0],
        venueById.get(shows[0].venue_id),
      )}`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${safeFileName(name)}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
