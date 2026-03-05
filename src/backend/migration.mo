import Map "mo:core/Map";
import Principal "mo:core/Principal";
import List "mo:core/List";

module {
  type WithoutTrustedPrincipalsActor = {
    userProfiles : Map.Map<Principal, { name : Text }>;
    userMangas : Map.Map<Principal, List.List<{
      id : Text;
      title : Text;
      synopsis : Text;
      altTitle1 : Text;
      altTitle2 : Text;
      status : { #Reading; #Completed; #OnHold; #Dropped; #PlanToRead };
      currentChapter : Nat;
      totalChapters : ?Nat;
      rating : ?Nat;
      coverImageUrl : ?Text;
      notes : Text;
      genres : [Text];
      createdAt : Int;
      updatedAt : Int;
    }>>;
  };

  type WithTrustedPrincipalsActor = {
    userProfiles : Map.Map<Principal, { name : Text }>;
    userMangas : Map.Map<Principal, List.List<{
      id : Text;
      title : Text;
      synopsis : Text;
      altTitle1 : Text;
      altTitle2 : Text;
      status : { #Reading; #Completed; #OnHold; #Dropped; #PlanToRead };
      currentChapter : Nat;
      totalChapters : ?Nat;
      rating : ?Nat;
      coverImageUrl : ?Text;
      notes : Text;
      genres : [Text];
      createdAt : Int;
      updatedAt : Int;
    }>>;
    trustedPrincipals : Map.Map<Principal, Bool>;
  };

  public func run(old : WithoutTrustedPrincipalsActor) : WithTrustedPrincipalsActor {
    { old with trustedPrincipals = Map.empty<Principal, Bool>() };
  };
};
