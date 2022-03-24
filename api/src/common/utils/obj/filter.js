/* eslint-disable no-nested-ternary */
class ObjectBuilder {
  static filterObject(obj, condition, objCondition) {
    return Object.entries(obj)
      .filter(([key, value]) => condition(value, key))
      .reduce(
        (acc, [key, value]) => ({
          ...acc,
          [key]: Array.isArray(value)
            ? value
            : value === objCondition(value)
            ? this.filterObject(value, condition)
            : value,
        }),
        {},
      );
  }
}

exports.ObjectBuilder = ObjectBuilder;
