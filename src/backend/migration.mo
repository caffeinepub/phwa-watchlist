import Map "mo:core/Map";
import List "mo:core/List";
import Principal "mo:core/Principal";
import Int "mo:core/Int";

module {
  type OldActor = {
    userProfiles : Map.Map<Principal, { name : Text }>;
    userMangas : Map.Map<Principal, List.List<OldMangaEntry>>;
  };

  type OldMangaEntry = {
    id : Text;
    title : Text;
    synopsis : Text;
    altTitle1 : Text;
    altTitle2 : Text;
    status : OldMangaStatus;
    currentChapter : Nat;
    totalChapters : ?Nat;
    rating : ?Nat;
    coverImageUrl : ?Text;
    notes : Text;
    genres : [Text];
    createdAt : Int.Int;
    updatedAt : Int.Int;
  };

  type OldMangaStatus = {
    #Reading;
    #Completed;
    #OnHold;
    #Dropped;
    #PlanToRead;
  };

  type NewActor = {
    userProfiles : Map.Map<Principal, { name : Text }>;
    userMangas : Map.Map<Principal, List.List<NewMangaEntry>>;
  };

  // New Types
  type NewMangaEntry = {
    id : Text;
    title : Text;
    synopsis : Text;
    altTitle1 : Text;
    altTitle2 : Text;
    status : NewMangaStatus;
    currentChapter : Nat;
    totalChapters : ?Nat;
    rating : ?Nat;
    coverImageUrl : ?Text;
    notes : Text;
    genres : [Text];
    createdAt : Int.Int;
    updatedAt : Int.Int;
    isFavourite : Bool;
  };

  type NewMangaStatus = {
    #Reading;
    #Completed;
    #OnHold;
    #Dropped;
    #PlanToRead;
    #Incomplete;
  };

  public func run(old : OldActor) : NewActor {
    let newUserMangas = old.userMangas.map<Principal, List.List<OldMangaEntry>, List.List<NewMangaEntry>>(
      func(_principal, oldList) {
        let newList = List.empty<NewMangaEntry>();
        oldList.values().forEach(
          func(oldEntry) {
            newList.add({
              oldEntry with
              isFavourite = false; // Default to false
              status = switch (oldEntry.status) {
                case (#Reading) { #Reading };
                case (#Completed) { #Completed };
                case (#OnHold) { #OnHold };
                case (#Dropped) { #Dropped };
                case (#PlanToRead) { #PlanToRead };
              };
            });
          }
        );
        newList;
      }
    );
    { old with userMangas = newUserMangas };
  };
};
