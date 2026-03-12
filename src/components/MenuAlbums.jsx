import { useLocation, useNavigate } from "react-router-dom"
import "../styles/MenuAlbums.css"
import { useTranslation } from "react-i18next"

function MenuAlbums({ tab = "albums", onChangeTab }) {
  const { t } = useTranslation()

  const isLists = tab === "lists"

  return (
    <div className="menuAlbumsTop">
      <div className="menuAlbumsContent">
        <div className="menuAlbumItem">
          <div className={`switch ${isLists ? "active" : ""}`}>
            <button
              type="button"
              className="label"
              onClick={() => onChangeTab?.("albums")}
            >
              {t("menuAlbums.album")}
            </button>

            <button
              type="button"
              className="label"
              onClick={() => onChangeTab?.("lists")}
            >
              {t("menuAlbums.lists")}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default MenuAlbums