"use client";

import { useEffect, useMemo } from "react";
import { Mail, MapPin } from "lucide-react";
import { useBookingStore } from "../../stores/useBookingStore";
import { formatDate, splitLines } from "./bookingFormat";
import "../../../styles/entry-list.css";
import "../../../styles/booking/booking.css";

export default function BookingVenues() {
  // *** VARIABLES ***
  const venues = useBookingStore((state) => state.venues);
  const shows = useBookingStore((state) => state.shows);
  const projects = useBookingStore((state) => state.projects);
  const loading = useBookingStore((state) => state.loading);
  const loaded = useBookingStore((state) => state.loaded);
  const ensureBooking = useBookingStore((state) => state.ensureBooking);

  // Shows per venue, with their project name, for the "Gespielt / geplant" line.
  const showsByVenue = useMemo(() => {
    const projectName = new Map(projects.map((p) => [p.id, p.name]));
    const map = new Map();
    for (const show of shows) {
      if (!show.venue_id) continue;
      if (!map.has(show.venue_id)) map.set(show.venue_id, []);
      map.get(show.venue_id).push({
        ...show,
        projectName: projectName.get(show.project_id),
      });
    }
    return map;
  }, [shows, projects]);

  // *** FUNCTIONS/HANDLERS ***
  useEffect(() => {
    ensureBooking();
  }, [ensureBooking]);

  return (
    <div className="entry-list booking">
      <div className="entry-list-toolbar booking-toolbar">
        <div className="entry-list-header">
          <h2 className="section-title">Venues</h2>
        </div>
      </div>

      {loading && !loaded && <p>Venues werden geladen...</p>}

      {loaded && venues.length === 0 && (
        <div className="entry-list-empty">
          <p>Noch keine Venues in diesem Workspace.</p>
        </div>
      )}

      <div className="booking-venues">
        {venues.map((venue) => {
          const venueShows = showsByVenue.get(venue.id) || [];
          return (
            <section key={venue.id} className="booking-card">
              <h3 className="booking-venue-name">{venue.name}</h3>
              {venue.city && (
                <span className="booking-detail-sub">{venue.city}</span>
              )}

              <dl className="booking-facts">
                {venue.address && (
                  <div className="booking-fact">
                    <dt>Adresse</dt>
                    <dd>
                      {splitLines(venue.address).map((l) => (
                        <div key={l}>{l}</div>
                      ))}
                      <a
                        className="booking-link"
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                          `${venue.name}, ${venue.address.replace(/\n/g, ", ")}`,
                        )}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <MapPin size={14} /> Karte
                      </a>
                    </dd>
                  </div>
                )}
                {(venue.contact_name || venue.contact_email) && (
                  <div className="booking-fact">
                    <dt>Kontakt</dt>
                    <dd>
                      {venue.contact_name && <div>{venue.contact_name}</div>}
                      {venue.contact_email && (
                        <a
                          className="booking-link"
                          href={`mailto:${venue.contact_email}`}
                        >
                          <Mail size={14} /> {venue.contact_email}
                        </a>
                      )}
                    </dd>
                  </div>
                )}
                {venueShows.length > 0 && (
                  <div className="booking-fact">
                    <dt>Shows</dt>
                    <dd>
                      {venueShows.map((s) => (
                        <div key={s.id}>
                          {formatDate(s.show_date)}
                          {s.projectName && (
                            <span className="booking-muted">
                              {" "}
                              · {s.projectName}
                            </span>
                          )}
                        </div>
                      ))}
                    </dd>
                  </div>
                )}
              </dl>

              {venue.tech_specs && (
                <details className="booking-details">
                  <summary>Pult / Tech Specs</summary>
                  <div className="booking-pre">{venue.tech_specs}</div>
                </details>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
