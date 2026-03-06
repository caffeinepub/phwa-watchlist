import Map "mo:core/Map";
import List "mo:core/List";
import Principal "mo:core/Principal";

module {
  type MangaEntry = {
    id : Text;
    title : Text;
    synopsis : Text;
    altTitle1 : Text;
    altTitle2 : Text;
    status : {
      #Reading;
      #Completed;
      #OnHold;
      #Dropped;
      #PlanToRead;
      #Incomplete;
    };
    currentChapter : Nat;
    totalChapters : ?Nat;
    rating : ?Nat;
    artRating : ?Float;
    cenLvl : ?Float;
    coverImageUrl : ?Text;
    notes : Text;
    genres : [Text];
    createdAt : Int;
    updatedAt : Int;
    isFavourite : Bool;
  };

  type OldActor = {
    userProfiles : Map.Map<Principal, { name : Text }>;
    userMangas : Map.Map<Principal, List.List<MangaEntry>>;
  };

  public func run(old : OldActor) : OldActor {
    old;
  };
};
