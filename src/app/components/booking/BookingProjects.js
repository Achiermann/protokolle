"use client";

import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { FileDown, Plus } from "lucide-react";
import { useBookingStore } from "../../stores/useBookingStore";
import { useAuthStore } from "../../stores/useAuthStore";
import ShowDetail from "./Tourplan";
import InternSheet from "./InternSheet";
import ProjectPanel from "./ProjectPanel";
import { showTabLabel } from "./bookingFormat";
import "../../../styles/entry-list.css";
import "../../../styles/booking/booking.css";

// Karteikarten of a project. Only the Tourplan exists so far; it is offered
// for tours.
const TABS = [{ key: "tourplan", label: "Tourplan", kinds: ["tour"] }];

const todayIso = () => {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

// mode "public": the read-only sheet (what non-admin members see).
// mode "intern": the same sheet with every value editable (admins only).
export default function BookingProjects({ mode = "public" }) {
  // *** VARIABLES ***
  const projects = useBookingStore((state) => state.projects);
  const shows = useBookingStore((state) => state.shows);
  const venues = useBookingStore((state) => state.venues);
  const loading = useBookingStore((state) => state.loading);
  const loaded = useBookingStore((state) => state.loaded);
  const ensureBooking = useBookingStore((state) => state.ensureBooking);
  const createProject = useBookingStore((state) => state.createProject);
  const createShow = useBookingStore((state) => state.createShow);
  const isIntern = mode === "intern";
  const workspaceName = useAuthStore((state) => state.workspace?.name) || "";

  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [activeTab, setActiveTab] = useState("tourplan");
  const [selectedShowId, setSelectedShowId] = useState(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [creating, setCreating] = useState(false);

  const project =
    projects.find((p) => p.id === selectedProjectId) || projects[0] || null;
  const tabs = project
    ? TABS.filter((t) => t.kinds.includes(project.kind))
    : [];
  const tab = tabs.find((t) => t.key === activeTab) || tabs[0] || null;

  const venueById = useMemo(
    () => new Map(venues.map((v) => [v.id, v])),
    [venues],
  );
  const projectShows = useMemo(
    () =>
      project
        ? shows
            .filter((s) => s.project_id === project.id)
            .sort((a, b) => a.show_date.localeCompare(b.show_date))
        : [],
    [shows, project],
  );

  // Default to the next upcoming show (or the last one once the tour is over).
  const selectedShow = useMemo(() => {
    const chosen = projectShows.find((s) => s.id === selectedShowId);
    if (chosen) return chosen;
    const today = todayIso();
    return (
      projectShows.find((s) => s.show_date >= today) ||
      projectShows[projectShows.length - 1] ||
      null
    );
  }, [projectShows, selectedShowId]);

  // *** FUNCTIONS/HANDLERS ***
  useEffect(() => {
    ensureBooking();
  }, [ensureBooking]);

  const handleProjectChange = (id) => {
    setSelectedProjectId(id);
    setSelectedShowId(null);
  };

  // "Neues Projekt", "Neues Projekt 2", … — renamed afterwards in the panel.
  const handleNewProject = async () => {
    const names = new Set(projects.map((p) => p.name));
    let name = "Neues Projekt";
    for (let n = 2; names.has(name); n += 1) name = `Neues Projekt ${n}`;
    setCreating(true);
    try {
      const item = await createProject(name);
      handleProjectChange(item.id);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setCreating(false);
    }
  };

  // New gig in the current project, dated the day after its last gig (or
  // today for an empty project), then selected for editing.
  const handleNewGig = async () => {
    if (!project) return;
    const last = projectShows[projectShows.length - 1]?.show_date;
    let date = todayIso();
    if (last) {
      const d = new Date(`${last}T12:00:00`);
      d.setDate(d.getDate() + 1);
      date = d.toISOString().slice(0, 10);
    }
    setCreating(true);
    try {
      const item = await createShow(project.id, date);
      setSelectedShowId(item.id);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setCreating(false);
    }
  };

  // The PDF code is only loaded on demand — it is heavy and browser-only.
  const handlePdf = async (pdfShows, withCover) => {
    if (!project || pdfShows.length === 0) return;
    setPdfBusy(true);
    try {
      const { downloadTourPdf } = await import("./TourPdf");
      await downloadTourPdf({
        workspaceName,
        project,
        shows: pdfShows,
        venueById,
        withCover,
      });
    } catch (error) {
      console.error(error);
      toast.error("PDF konnte nicht erstellt werden.");
    } finally {
      setPdfBusy(false);
    }
  };

  return (
    <div className="entry-list booking">
      <div className="entry-list-toolbar booking-toolbar">
        <div className="entry-list-header">
          <h2 className="section-title">Projekte</h2>
        </div>

        {(projects.length > 0 || isIntern) && (
          <div className="booking-project-picker" role="tablist">
            {projects.map((p) => (
              <button
                key={p.id}
                type="button"
                role="tab"
                aria-selected={project?.id === p.id}
                className={`booking-project-pill ${project?.id === p.id ? "active" : ""}`}
                onClick={() => handleProjectChange(p.id)}
              >
                {p.name}
              </button>
            ))}
            {isIntern && (
              <button
                type="button"
                className="booking-project-pill booking-add-button"
                onClick={handleNewProject}
                disabled={creating}
              >
                <Plus size={14} />
                Neues Projekt
              </button>
            )}
          </div>
        )}

        {tabs.length > 0 && (
          <div className="booking-tabs" role="tablist">
            {tabs.map((t) => (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={tab?.key === t.key}
                className={`booking-tab ${tab?.key === t.key ? "active" : ""}`}
                onClick={() => setActiveTab(t.key)}
              >
                {t.label}
              </button>
            ))}
            {tab?.key === "tourplan" && projectShows.length > 0 && (
              <button
                type="button"
                className="secondary booking-pdf-button booking-tabs-action"
                onClick={() => handlePdf(projectShows, true)}
                disabled={pdfBusy}
              >
                <FileDown size={16} />
                {pdfBusy ? "PDF wird erstellt…" : "PDF Tour"}
              </button>
            )}
          </div>
        )}

        {tab?.key === "tourplan" && (projectShows.length > 0 || isIntern) && (
          <div
            className="booking-tabs booking-show-tabs"
            role="tablist"
            aria-label="Konzerte"
          >
            {isIntern && (
              <button
                type="button"
                className="booking-tab booking-add-button"
                onClick={handleNewGig}
                disabled={creating}
              >
                <Plus size={14} />
                Neuer Gig
              </button>
            )}
            {projectShows.map((show) => (
              <button
                key={show.id}
                type="button"
                role="tab"
                aria-selected={selectedShow?.id === show.id}
                className={`booking-tab ${selectedShow?.id === show.id ? "active" : ""}`}
                onClick={() => setSelectedShowId(show.id)}
              >
                {showTabLabel(show, venueById.get(show.venue_id))}
              </button>
            ))}
          </div>
        )}
      </div>

      {loading && !loaded && <p>Projekte werden geladen...</p>}

      {loaded && projects.length === 0 && (
        <div className="entry-list-empty">
          <p>
            {mode === "intern"
              ? "Noch keine Projekte in diesem Workspace."
              : "Du wurdest noch keinem Projekt hinzugefügt."}
          </p>
        </div>
      )}

      {project && tab?.key === "tourplan" && projectShows.length === 0 && (
        <div className="entry-list-empty">
          <p>
            {isIntern
              ? "Dieses Projekt hat noch keine Gigs. Mit „+ Neuer Gig“ anlegen."
              : "Dieses Projekt hat noch keine Daten."}
          </p>
        </div>
      )}

      {tab?.key === "tourplan" && selectedShow && mode === "intern" && (
        <InternSheet
          key={selectedShow.id}
          show={selectedShow}
          venue={venueById.get(selectedShow.venue_id)}
          onPdf={() => handlePdf([selectedShow], false)}
          pdfBusy={pdfBusy}
          onMoved={(projectId) => setSelectedProjectId(projectId)}
          onDeleted={() => setSelectedShowId(null)}
        />
      )}

      {tab?.key === "tourplan" && selectedShow && mode === "public" && (
        <ShowDetail
          key={selectedShow.id}
          show={selectedShow}
          venue={venueById.get(selectedShow.venue_id)}
          onPdf={() => handlePdf([selectedShow], false)}
          pdfBusy={pdfBusy}
        />
      )}

      {isIntern && project && (
        <ProjectPanel key={project.id} project={project} />
      )}
    </div>
  );
}
