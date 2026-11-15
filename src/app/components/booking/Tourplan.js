"use client";

import { FileDown, Mail, MapPin } from "lucide-react";
import {
  buildShowSections,
  showHeading,
  showVenue,
  fullWidthSections,
  isLongText,
  oneLine,
  splitColumns,
} from "./bookingFormat";

const LINK_ICONS = { map: MapPin, mail: Mail };

function SectionBody({ section }) {
  if (section.type === "schedule") {
    return (
      <table className="booking-schedule">
        <tbody>
          {section.rows.map((row, i) => (
            <tr key={i}>
              <td className="booking-schedule-time">{row.time}</td>
              <td>{row.text}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }
  if (section.type === "text") {
    return (
      <div
        className={`booking-pre ${isLongText(section.text) ? "booking-pre-columns" : ""}`}
      >
        {section.text}
      </div>
    );
  }
  return (
    <dl className="booking-facts">
      {section.rows.map((row) => (
        <div key={row.label} className="booking-fact">
          <dt>{row.label}</dt>
          <dd>
            {row.lines.map((line, i) => (
              <div key={i}>{line}</div>
            ))}
            {row.links.map((link) => {
              const Icon = LINK_ICONS[link.kind];
              return (
                <a
                  key={link.href}
                  className="booking-link"
                  href={link.href}
                  {...(link.kind === "map"
                    ? { target: "_blank", rel: "noreferrer" }
                    : {})}
                >
                  {Icon && <Icon size={14} />} {link.text}
                </a>
              );
            })}
          </dd>
        </div>
      ))}
    </dl>
  );
}

// One show, laid out like a PDF page: a single column, sections separated by
// a full-width black rule (none between the heading and the first section).
export default function ShowDetail({ show, venue, onPdf, pdfBusy }) {
  const sections = buildShowSections(show, venue);
  const venueBlock = showVenue(venue);

  return (
    <article className="booking-sheet">
      <header className="booking-sheet-header">
        <div className="booking-sheet-header-text">
          <h2 className="booking-detail-title">{showHeading(show, venue)}</h2>
          {show.event_name && (
            <span className="booking-detail-sub">{show.event_name}</span>
          )}
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

      {sections.length === 0 && !venueBlock && (
        <p className="booking-muted">
          Für diese Show gibt es noch keine Infos.
        </p>
      )}

      <div className="booking-sheet-columns">
        {splitColumns(sections).map((column, c) => (
          <div key={c} className="booking-sheet-column">
            {/* Left column opens with Setlänge, then the Adresse block. */}
            {c === 0 && show.set_length && (
              <div className="booking-sheet-venue booking-sheet-inline">
                <h3 className="booking-card-title">Setlänge</h3>
                <span>{oneLine(show.set_length)}</span>
              </div>
            )}
            {c === 0 && venueBlock && (
              <div className="booking-sheet-venue">
                <h3 className="booking-card-title">Adresse</h3>
                <address>
                  {venueBlock.lines.map((line, i) => (
                    <div key={i}>{line}</div>
                  ))}
                </address>
                {venueBlock.mapsUrl && (
                  <a
                    className="booking-link"
                    href={venueBlock.mapsUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <MapPin size={14} /> Karte
                  </a>
                )}
              </div>
            )}
            {column.map((section, i) => (
              <section key={section.key} className="booking-sheet-section">
                {i > 0 && <hr className="booking-sheet-rule" />}
                <h3 className="booking-card-title">{section.title}</h3>
                <SectionBody section={section} />
              </section>
            ))}
          </div>
        ))}
      </div>

      {/* Long free text (tech specs, notes) spans both columns at the end. */}
      {fullWidthSections(sections).map((section) => (
        <section key={section.key} className="booking-sheet-section">
          <hr className="booking-sheet-rule" />
          <h3 className="booking-card-title">{section.title}</h3>
          <SectionBody section={section} />
        </section>
      ))}
    </article>
  );
}
