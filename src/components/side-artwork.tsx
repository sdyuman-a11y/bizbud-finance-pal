import sideArtwork from "@/assets/financial-side-art.png";

export function SideArtwork() {
  return (
    <div className="side-artwork" aria-hidden="true">
      <div className="side-artwork-rail side-artwork-left">
        <img src={sideArtwork} alt="" width={512} height={1536} loading="lazy" />
      </div>
      <div className="side-artwork-rail side-artwork-right">
        <img src={sideArtwork} alt="" width={512} height={1536} loading="lazy" />
      </div>
    </div>
  );
}