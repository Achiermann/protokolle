"use client";

import { useMemo } from "react";
import toast from "react-hot-toast";
import { FileDown, Trash } from "lucide-react";
import { useBookingStore } from "../../stores/useBookingStore";
import { CHECKLISTS, NEW_VENUE_NAME } from "@/lib/bookingFields";
import EditableField from "./EditableField";
import {
  formatDateShort,
  fullWidthSections,
  isLongText,
  splitColumns,
  splitLines,
} from "./bookingFormat";
import ScheduleEditor from "./ScheduleEditor";

// Every editable field of the Intern sheet, grouped like the Public sheet.
// source: which row the value lives on — the show, or its venue (shared by
// every show played there).
const SECTIONS = [
  {
    key: "schedule",
    title: "Schedule",
    fields: [
      {
        source: "show",
        key: "schedule_items",
        label: "Schedule",
        display: "schedule",
        bare: true,
      },
    ],
  },
  {
    key: "kontakte",
    title: "Kontakte",
    fields: [
      { source: "venue", key: "contact_name", label: "Kontakt" },
      { source: "venue", key: "contact_email", label: "E-Mail" },
    ],
  },
  {
    key: "team",
    title: "Line-Up & Team",
    fields: [
      { source: "show", key: "line_up", label: "Line-Up", multiline: true },
      { source: "show", key: "tech_person", label: "Technik" },
      { source: "show", key: "merch_person", label: "Merch" },
    ],
  },
  {
    key: "tech",
    title: "Pult / Tech Specs",
    fields: [
      {
        source: "venue",
        key: "tech_specs",
        label: "Venue",
        multiline: true,
        columnsWhenLong: true,
      },
      {
        source: "show",
        key: "tech_notes",
        label: "Nur diese Show",
        multiline: true,
        columnsWhenLong: true,
      },
    ],
  },
  {
    key: "uebernachtung",
    title: "Übernachtung",
    fields: [
      // One row whose left side (label) is editable too: "Hotel" | address.
      {
        source: "show",
        key: "accommodation_address",
        labelKey: "accommodation_label",
        label: "Unterkunft",
        display: "labeled",
        multiline: true,
      },
      { source: "show", key: "accommodation", label: "Info", multiline: true },
    ],
  },
  {
    key: "sonstiges",
    title: "Sonstige Infos",
    fields: [
      { source: "show", key: "deal", label: "Deal", multiline: true },
      {
        source: "show",
        key: "ticket_price",
        label: "Eintritt",
        multiline: true,
      },
      {
        source: "show",
        key: "travel_party",
        label: "Travel Party",
        type: "number",
        suffix: " Personen",
      },
      { source: "show", key: "hosting", label: "Hosting", multiline: true },
      { source: "show", key: "dinner", label: "Dinner", multiline: true },
      { source: "show", key: "parking", label: "Parkplätze", multiline: true },
      { source: "show", key: "payout", label: "Gage", multiline: true },
    ],
  },
  {
    key: "notes",
    title: "Notizen",
    fields: [
      {
        source: "show",
        key: "notes",
        label: "Notizen",
        multiline: true,
        bare: true,
        columnsWhenLong: true,
      },
    ],
  },
];

// `columns`: long text (more than LONG_TEXT_LINES) flows into two columns.
function MultilineView({ text, columns = false }) {
  if (columns && isLongText(text)) {
    return <div className="booking-pre booking-pre-columns">{text}</div>;
  }
  return splitLines(text).map((line, i) => <div key={i}>{line}</div>);
}

// The editable twin of the Public sheet: same layout, but every value can be
// clicked and edited, and empty fields are shown so they can be filled in.
export default function InternSheet({
  show,
  venue,
  onPdf,
  pdfBusy,
  onMoved,
  onDeleted,
}) {
  // *** VARIABLES ***
  const venues = useBookingStore((state) => state.venues);
  const shows = useBookingStore((state) => state.shows);
  const projects = useBookingStore((state) => state.projects);
  const updateShow = useBookingStore((state) => state.updateShow);
  const updateVenue = useBookingStore((state) => state.updateVenue);
  const deleteShow = useBookingStore((state) => state.deleteShow);
  const deleteVenue = useBookingStore((state) => state.deleteVenue);
  const sortedVenues = useMemo(
    () => venues.slice().sort((a, b) => a.name.localeCompare(b.name, "de-CH")),
    [venues],
  );

  // *** FUNCTIONS/HANDLERS ***
  const save = (source, key) => async (value) => {
    try {
      if (source === "venue") await updateVenue(venue.id, { [key]: value });
      else await updateShow(show.id, { [key]: value });
    } catch (error) {
      toast.error(error.message);
    }
  };

  // An untouched placeholder venue (from "+ Neuer Gig") that no gig uses any
  // more is removed, so swapping in an existing venue leaves no clutter.
  const isUnusedPlaceholder = (v) =>
    v &&
    v.name === NEW_VENUE_NAME &&
    !v.city &&
    !v.address &&
    !v.contact_name &&
    !v.contact_email &&
    !v.tech_specs &&
    !v.notes &&
    !shows.some((s) => s.venue_id === v.id && s.id !== show.id);

  const handleVenueChange = async (venueId) => {
    const previous = venue;
    try {
      await updateShow(show.id, { venue_id: venueId });
      if (isUnusedPlaceholder(previous)) await deleteVenue(previous.id);
    } catch (error) {
      toast.error(error.message);
    }
  };

  // Migrate the gig to another project; the view follows it there.
  const handleProjectChange = async (projectId) => {
    try {
      await updateShow(show.id, { project_id: projectId });
      onMoved?.(projectId);
    } catch (error) {
      toast.error(error.message);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Diesen Gig wirklich löschen?")) return;
    try {
      await deleteShow(show.id);
      if (isUnusedPlaceholder(venue)) await deleteVenue(venue.id);
      onDeleted?.();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const saveChecklist = (key) => async (value) => {
    try {
      await updateShow(show.id, {
        checklist: { ...(show.checklist || {}), [key]: value },
      });
    } catch (error) {
      toast.error(error.message);
    }
  };

  const renderValue = (field, value) => {
    if (field.multiline) {
      return <MultilineView text={value} columns={field.columnsWhenLong} />;
    }
    if (field.suffix) return `${value}${field.suffix}`;
    return value;
  };

  const renderField = (field) => {
    if (field.display === "schedule") {
      return (
        <div key={field.key} className="booking-edit-bare">
          <ScheduleEditor
            items={show.schedule_items}
            onSave={save("show", "schedule_items")}
          />
        </div>
      );
    }
    if (field.display === "labeled") {
      const address = show[field.key];
      return (
        <div key={field.key} className="booking-fact">
          <dt>
            <EditableField
              value={show[field.labelKey]}
              label="Art der Unterkunft"
              placeholder="Hotel"
              onSave={save("show", field.labelKey)}
            />
          </dt>
          <dd>
            <EditableField
              value={address}
              label="Adresse der Unterkunft"
              placeholder="Adresse"
              multiline
              onSave={save("show", field.key)}
            >
              {address ? <MultilineView text={address} /> : null}
            </EditableField>
          </dd>
        </div>
      );
    }
    if (field.source === "venue" && !venue) return null;
    const row = field.source === "venue" ? venue : show;
    const value = row[field.key];
    const editor = (
      <EditableField
        value={value}
        label={field.label}
        type={field.type}
        multiline={field.multiline}
        onSave={save(field.source, field.key)}
      >
        {value !== null && value !== undefined && value !== ""
          ? renderValue(field, value)
          : null}
      </EditableField>
    );
    if (field.bare) {
      return (
        <div key={field.key} className="booking-edit-bare">
          {editor}
        </div>
      );
    }
    return (
      <div key={`${field.source}-${field.key}`} className="booking-fact">
        <dt>{field.label}</dt>
        <dd>{editor}</dd>
      </div>
    );
  };

  return (
    <article className="booking-sheet booking-sheet-intern">
      <div className="booking-intern-pickers">
        <label className="booking-venue-picker">
          Projekt
          <select
            value={show.project_id}
            onChange={(e) => handleProjectChange(e.target.value)}
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="booking-venue-picker">
          Venue
          <select
            value={show.venue_id || ""}
            onChange={(e) => handleVenueChange(e.target.value || null)}
          >
            <option value="">Keine Venue</option>
            {sortedVenues.map((v) => (
              <option key={v.id} value={v.id}>
                {[v.name, v.city].filter(Boolean).join(", ")}
              </option>
            ))}
          </select>
        </label>
      </div>
      <header className="booking-sheet-header">
        <div className="booking-sheet-header-text">
          <h2 className="booking-detail-title">
            <EditableField
              value={show.show_date}
              type="date"
              label="Datum"
              onSave={save("show", "show_date")}
            >
              {formatDateShort(show.show_date)}
            </EditableField>
            {", "}
            {venue ? (
              <>
                <EditableField
                  value={venue.name}
                  label="Venue"
                  onSave={save("venue", "name")}
                />
                {", "}
                <EditableField
                  value={venue.city}
                  label="Ort"
                  placeholder="Ort"
                  onSave={save("venue", "city")}
                />
              </>
            ) : (
              <EditableField
                value={show.label}
                label="Titel"
                placeholder="Offen"
                onSave={save("show", "label")}
              />
            )}
          </h2>
          <span className="booking-detail-sub">
            <EditableField
              value={show.event_name}
              label="Veranstaltung"
              placeholder="Veranstaltung"
              onSave={save("show", "event_name")}
            />
          </span>
        </div>
        <button
          type="button"
          className="secondary booking-pdf-button"
          onClick={onPdf}
          disabled={pdfBusy}
        >
          <FileDown size={16} />
          PDF Show
        </button>
      </header>

      <div className="booking-sheet-columns">
        {splitColumns(SECTIONS).map((column, c) => {
          // Empty sections (venue fields without a venue) are skipped, and
          // the rule only goes between the sections of one column.
          const rendered = column
            .map((section) => ({
              section,
              fields: section.fields.map(renderField).filter(Boolean),
            }))
            .filter(({ fields }) => fields.length > 0);
          return (
            <div key={c} className="booking-sheet-column">
              {/* Left column opens with Setlänge, then the Adresse block. */}
              {c === 0 && (
                <div className="booking-sheet-venue booking-sheet-inline">
                  <h3 className="booking-card-title">Setlänge</h3>
                  <EditableField
                    value={show.set_length}
                    label="Setlänge"
                    placeholder="z.B. 45–60 min"
                    onSave={save("show", "set_length")}
                  />
                </div>
              )}
              {c === 0 && venue && (
                <div className="booking-sheet-venue">
                  <h3 className="booking-card-title">Adresse</h3>
                  <div>
                    <EditableField
                      value={venue.name}
                      label="Venue-Name"
                      onSave={save("venue", "name")}
                    />
                  </div>
                  <EditableField
                    value={venue.address}
                    label="Adresse"
                    placeholder="Adresse"
                    multiline
                    onSave={save("venue", "address")}
                  >
                    {venue.address ? (
                      <MultilineView text={venue.address} />
                    ) : null}
                  </EditableField>
                </div>
              )}
              {rendered.map(({ section, fields }, i) => (
                <section key={section.key} className="booking-sheet-section">
                  {i > 0 && <hr className="booking-sheet-rule" />}
                  <h3 className="booking-card-title">{section.title}</h3>
                  {section.key === "kontakte" || section.key === "tech" ? (
                    <p className="booking-sheet-hint">
                      {section.key === "kontakte"
                        ? "Gilt für alle Shows an dieser Venue."
                        : "„Venue“ gilt für alle Shows an dieser Venue."}
                    </p>
                  ) : null}
                  <dl className="booking-facts">{fields}</dl>
                </section>
              ))}
              {c === 1 && (
                <section className="booking-sheet-section">
                  <hr className="booking-sheet-rule" />
                  <h3 className="booking-card-title">Checklisten</h3>
                  <p className="booking-sheet-hint">
                    Nur intern, nicht in Public/PDF.
                  </p>
                  <div className="booking-checklists">
                    {CHECKLISTS.map((list) => (
                      <dl
                        key={list.title}
                        className="booking-facts booking-checklist"
                      >
                        <span className="booking-checklist-title">
                          {list.title}
                        </span>
                        {list.items.map((item) => (
                          <div key={item.key} className="booking-fact">
                            <dt>{item.label}</dt>
                            <dd>
                              <EditableField
                                value={show.checklist?.[item.key]}
                                label={item.label}
                                onSave={saveChecklist(item.key)}
                              />
                            </dd>
                          </div>
                        ))}
                      </dl>
                    ))}
                  </div>
                </section>
              )}
            </div>
          );
        })}
      </div>

      {/* Long free text (tech specs, notes) spans both columns at the end. */}
      {fullWidthSections(SECTIONS).map((section) => {
        const fields = section.fields.map(renderField).filter(Boolean);
        if (fields.length === 0) return null;
        return (
          <section key={section.key} className="booking-sheet-section">
            <hr className="booking-sheet-rule" />
            <h3 className="booking-card-title">{section.title}</h3>
            {section.key === "tech" && (
              <p className="booking-sheet-hint">
                „Venue“ gilt für alle Shows an dieser Venue.
              </p>
            )}
            <dl className="booking-facts">{fields}</dl>
          </section>
        );
      })}

      <div className="booking-sheet-danger">
        <button type="button" className="secondary" onClick={handleDelete}>
          <Trash size={16} />
          Gig löschen
        </button>
      </div>
    </article>
  );
}
