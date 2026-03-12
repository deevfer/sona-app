import { useState, useRef, useEffect } from "react"
import "../styles/SearchMenu.css"
import SearchIcon from "../assets/search.svg?react"
import SquaresIcon from "../assets/squares.svg?react"
import ListIcon from "../assets/albums.svg?react"
import { useTranslation } from "react-i18next"

function SearchMenu({
  view = "grid",
  onToggleView,
  searchQuery = "",
  onSearchChange,
  hidden = false,
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)

  const inputRef = useRef(null)
  const containerRef = useRef(null)

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus()
    }
  }, [open])

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!containerRef.current) return

      if (!containerRef.current.contains(event.target)) {
        setOpen(false)
        onSearchChange("")
      }
    }

    document.addEventListener("mousedown", handleClickOutside)

    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [onSearchChange])

  const handleToggle = () => {
    if (open) {
      onSearchChange("")
      setOpen(false)
    } else {
      setOpen(true)
    }
  }

  const isGrid = view === "grid"

  return (
    <div
      className={`searchMenuTop ${hidden ? "searchMenuHidden" : "searchMenuVisible"}`}
      ref={containerRef}
    >
      <div className="searchMenuTopContent">
        <div className={`searchMenuItem searchExpandable ${open ? "searchOpen" : ""}`}>
          <button className="search" onClick={handleToggle}>
            <SearchIcon />
          </button>

          <input
            ref={inputRef}
            type="text"
            className="searchInput"
            placeholder={t("menuAlbums.search")}
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>

        <div className={`searchMenuItem viewToggle ${open ? "fadeOut" : "fadeIn"}`}>
          <button
            className={`listView ${isGrid ? "gridMode" : "listMode"}`}
            onClick={onToggleView}
          >
            <span className={`viewIcon ${isGrid ? "iconActive" : "iconHidden"}`}>
              <SquaresIcon />
            </span>
            <span className={`viewIcon ${!isGrid ? "iconActive" : "iconHidden"}`}>
              <ListIcon />
            </span>
          </button>
        </div>
      </div>
    </div>
  )
}

export default SearchMenu