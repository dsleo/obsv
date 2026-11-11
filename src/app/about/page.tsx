import Link from "next/link";
import { NewsMasthead } from "../../components/events/NewsMasthead";
import "../../components/events/event-pages.css";
import { pageMetadata } from "../../lib/metadata";
import { contactEmail, publicRelease, publisher } from "../../lib/siteConfig";

export const metadata = pageMetadata(
  "À propos, sources et corrections",
  "Notre démarche éditoriale, les sources et les moyens de signaler une erreur.",
);

export default function AboutPage() {
  return (
    <main className="news-page" id="contenu">
      <NewsMasthead section="À PROPOS" />
      <article className="about-content">
        <h1>
          À propos de <em>L’Observatoire.</em>
        </h1>
        <p>
          Nous rapprochons les sondages publiés de l’actualité de la présidentielle française pour
          faciliter la lecture et la vérification des informations.
        </p>
        {!publicRelease && !publisher && (
          <p className="preview-note">
            Ce site est en préparation. Les informations de l’éditeur et le contact public seront
            complétés avant son ouverture.
          </p>
        )}
        <section className="about-compact-section">
          <h2>Publication et sources</h2>
          <p>
            {publisher
              ? `Éditeur : ${publisher}. `
              : "L’Observatoire est un projet de suivi de l’actualité et des sondages. "}
            Chaque événement renvoie aux articles d’origine. Les sondages proviennent de{" "}
            <a href="https://sondax.fr">Sondax</a> ; la construction des simulations est expliquée
            dans la <Link href="/method">méthode</Link>.
          </p>
          {contactEmail && (
            <p>
              Contact : <a href={`mailto:${contactEmail}`}>{contactEmail}</a>.
            </p>
          )}
        </section>
        <section id="corrections" className="about-compact-section">
          <h2>Signaler une erreur</h2>
          <p>
            Indiquez le lien de l’actualité, le passage concerné et, si possible, une source
            originale permettant de le vérifier.
          </p>
          {contactEmail ? (
            <p>
              <a
                className="text-action"
                href={`mailto:${contactEmail}?subject=${encodeURIComponent("Correction — L’Observatoire")}`}
              >
                Contacter l’éditeur
              </a>
            </p>
          ) : (
            <p>Le contact de correction sera publié ici lors de l’ouverture publique.</p>
          )}
        </section>
        <section id="confidentialite" className="about-compact-section">
          <h2>Confidentialité</h2>
          <p>
            Le site ne demande pas de compte. Les filtres restent dans l’adresse de la page, sans
            profil utilisateur ni outil de suivi. Les sites sources appliquent leurs propres règles.
          </p>
        </section>
      </article>
    </main>
  );
}
