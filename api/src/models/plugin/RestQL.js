/* eslint-disable */
const { flattenObj } = require('../../common/utils/obj/flatten');
const { ObjectBuilder } = require('../../common/utils/obj/filter');
const { Types, model } = require('mongoose');

const EventEmitter = require('events');

const denormalizeEmitter = new EventEmitter();

const mergeExludedAliasValues = (as, mObj) => {
  console.log({ as, mObj });
  const obj = Object.entries(mObj);

  const asKeys = Object.keys(as);

  // obj.filter(([key, value]) => {
  asKeys.forEach(asK => {
    const providerKey = mObj[asK];
    // console.log({ obj, as, asKeys, mObj });
    console.log('providerKey', providerKey);
    console.log('obj[providerKey] ', obj[providerKey]);
    console.log('mObj[providerKey] ', mObj[providerKey]);

    mObj[asK] = mObj[providerKey];
  });
  // });

  return mObj;
};

// const IConsumer = {
//   fromRef,
//   toPath,
//   key,
//   as,
//   inArray,
//   withTimestamp,
//   consumerModel,
// };

const consumer = ops => {
  const options = ops || {};
  options.toPath = options.toPath || options.fromRef.toLowerCase();

  return schema => {
    const {
      toPath,
      key = '_id',
      inArray = false,
      as,
      fromRef,
      consumerModel,
      withTimestamp,
    } = options;
    if (withTimestamp) {
      schema.add({
        denormalizedAt: { type: Date },
      });
    }
    // eslint-disable-next-line @typescript-eslint/ban-types
    schema.pre(['save'], async function (next) {
      const ProviderModel = model(fromRef);

      const provider = await ProviderModel.findOne(
        { [key]: this[key] },
        { createdAt: 0, updatedAt: 0 },
      );

      if (!provider) {
        return next(new Error(`Denormalization failed for ${key}`));
      }

      const schemaFeilds = Object.keys(schema.paths);

      console.log({ consumerCreateschemaFeilds: schemaFeilds });

      if (as) {
        const aliasParsedObject = {};
        Object.entries(as).map(function ([key, value]) {
          const aliasKey = inArray ? `${toPath}.$.${key}` : `${toPath}.${key}`;
          aliasParsedObject[key] = provider[value];
          console.log(`provider value ${provider[value]}`);
        });
        // const excludeObjectValuesMap = flattenObj(as);
        // const providerObject = mergeExludedAliasValues(excludeObjectValuesMap, provider);
        // console.log({ providerObject });
      }

      schemaFeilds.forEach(k => {
        console.log({ k });
        console.log('provider[k] ', provider[k]);

        this[k] = provider[k];
        console.log('this[k] ', this[k]);
      });

      next();
    });

    denormalizeEmitter.on(`denormalize/publish/${fromRef}`, async data => {
      // Step-1: Get Model instance
      // const ProviderModel = model(fromRef);
      const ConsumerModel = model(consumerModel);

      // Step-2: Get updatable key from Provider
      const flattenPublishedData = flattenObj(data);

      // Step-3: Get updatable key on consumer
      const schemaFeilds = Object.keys(schema.paths);

      console.log(`consumerModel: ${consumerModel}`);
      console.log({ consumerSchemaFeilds: schemaFeilds, flattenPublishedData });

      const filteredFlattenedData = ObjectBuilder.filterObject(
        flattenPublishedData,
        (_, k) => schemaFeilds.includes(k),
        value => !(value instanceof Types.ObjectId) && Object(value),
      );

      // if (schema.paths[key]) {
      //   schema.path(key).set(data[key]);
      // }
      // console.log(providerPublishedKeys);

      // consumerUpdateKey && console.log(consumerUpdateKey[0], providerPublishedKeys[2]);

      // ObjectBuilder.filterObject(data);

      // schema.path(key).set(data[key]);

      //TODO: get denormable keys first like GQL

      // Step-4: Update ConsumerModel

      const filterQuery = {
        [`${toPath}.${key}`]: data[key],
      };

      console.log({ filterQuery });

      const updateFlattenData = Object.entries(filteredFlattenedData).reduce((acc, [k, value]) => {
        const consumerUpdateKeyPath = inArray ? `${toPath}.$.${k}` : `${toPath}.${k}`;
        return {
          ...acc,
          [consumerUpdateKeyPath]: value,
        };
      }, {});

      if (withTimestamp) {
        const denormalizeKey = inArray ? `${toPath}.$.denormalizedAt` : `${toPath}.denormalizedAt`;
        updateFlattenData[denormalizeKey] = new Date().toISOString();
      }
      console.log('START');
      console.log({ consumerCreateschemaFeilds: schemaFeilds });
      console.log({ provider: updateFlattenData });
      console.log({ flattenPublishedData });

      // TRANSFORM CONSUMER SCHEMA CREDENTIALS TO MONGOOSE TREE SCHEMA
      // ALIAS DENORM HERE
      if (as) {
        /**
         *  as: {
                copyName: 'auth.name',
                copyPhone: 'auth.phone',
                pTitle: 'providerTitle',
            },
            parseAliasMapToMongooseMap: {
                'provider.copyName': 'provider.auth.name',
                'provider.copyPhone': 'provider.auth.phone',
                'provider.pTitle': 'provider.providerTitle'
            }
         */
        const parseAliasMapToMongooseMap = {};

        Object.entries(as).map(function ([key, value]) {
          const aliasKey = inArray ? `${toPath}.$.${key}` : `${toPath}.${key}`;
          const aliasValue = inArray ? `${toPath}.$.${value}` : `${toPath}.${value}`;
          parseAliasMapToMongooseMap[aliasKey] = aliasValue;
        });
        console.log({
          provider: updateFlattenData,
          consumer: as,
          aliasMapping: parseAliasMapToMongooseMap,
        });
        const merged = mergeExludedAliasValues(parseAliasMapToMongooseMap, {
          ...updateFlattenData,
          ...parseAliasMapToMongooseMap,
        });
        console.log({ merged });

        const mergedUpdatedData = await ConsumerModel.findOneAndUpdate(
          filterQuery,
          { $set: merged },
          { new: true },
        );
        console.log({ mergedUpdatedData });

        // const excludeObjectValuesMap = flattenObj(as);
        // const providerObject = mergeExludedAliasValues(excludeObjectValuesMap, provider);
        // console.log({ providerObject });
      }
      console.log('STOP');

      console.log({ updateFlattenData });

      const consumerUpdatedData = await ConsumerModel.findOneAndUpdate(
        filterQuery,
        { $set: updateFlattenData },
        { new: true },
      );
      console.log({ consumerUpdatedData });
    });
  };
};

const provider = ops => {
  const options = ops || {};
  options.keyFields = options.keyFields || ['_id'];
  options.ignoredFields = [...(options.ignoredFields || []), 'createdAt', 'updatedAt'];

  return schema => {
    const { ignoredFields, keyFields } = options;

    const updateQueryMethods = {
      // findByIdAndUpdate: 'findById'
      findOneAndUpdate: 'findOne',
      update: 'find',
      updateOne: 'findOne',
      updateMany: 'find',
    };

    schema.post(Object.keys(updateQueryMethods), async function () {
      const self = this;
      // toRef
      const providerModelRef = self.model.modelName;

      const queryParams = this.getQuery();

      const updateParams = this.getUpdate();

      const updateFields = updateParams.$set || {};
      const listeningFields = Object.keys(updateFields).filter(v => !ignoredFields.includes(v));

      if (listeningFields.length === 0) {
        return;
      }
      const listeningUpdateFields = {};
      for (const key in updateFields) {
        if (listeningFields.includes(key)) {
          listeningUpdateFields[key] = updateFields[key];
        }
      }

      const keyFieldsFound = Object.keys(queryParams).filter(
        v => !Array.isArray(keyFields) || keyFields.includes(v),
      );

      console.log('keyFieldsFound', keyFieldsFound);

      let getKeyArray = [queryParams];

      console.log('getKeyArray 1', getKeyArray);

      /* jshint ignore:start*/
      if (keyFieldsFound.length !== keyFields.length) {
        const operation = self.op;
        const document = await self.model[updateQueryMethods[operation]](queryParams);
        if (!document || document.length === 0) {
          throw new Error('Document not found');
        }
        getKeyArray = Array.isArray(document) ? document : [document];
      }
      /* jshint ignore:end */
      getKeyArray.forEach(getKeyObj => {
        const keyFieldsObj =
          keyFields && keyFields.reduce((acc, v) => ({ ...acc, [v]: getKeyObj[v] }), {});
        const publishableData = { ...listeningUpdateFields, ...keyFieldsObj };
        console.log('publish these fields', publishableData);
        denormalizeEmitter.emit(`denormalize/publish/${providerModelRef}`, publishableData);
        // publish && publish(publishableData);
      });
    });
  };
};

module.exports = {
  provider,
  consumer,
  denormalizeEmitter,
};
